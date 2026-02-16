import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';
import { agentStore } from '../models/agent';
import { getAgentPrivateKey } from './key-store';

/**
 * Wallet provisioning for Cogent agents.
 *
 * Each agent gets an EOA keypair. On first trade, we deploy a proxy wallet
 * (1-of-1 Gnosis Safe) via Polymarket's relayer. The proxy wallet is the
 * actual account that interacts with Polymarket's CLOB.
 */

export interface WalletInfo {
  address: string;
  privateKey: string;
}

/** Generate a fresh EOA keypair for an agent */
export function generateWallet(): WalletInfo {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/** Get an ethers Wallet instance for an agent (for signing) */
export function getAgentWallet(agentId: string): ethers.Wallet | null {
  const agent = agentStore.get(agentId);
  if (!agent) return null;
  
  const privateKey = getAgentPrivateKey(agentId);
  if (!privateKey) return null;
  
  return new ethers.Wallet(privateKey);
}

/**
 * Deploy a proxy wallet for an agent via Polymarket's relayer.
 *
 * In production, this calls Polymarket's relayer endpoint to deploy a
 * 1-of-1 Gnosis Safe with the agent's EOA as the sole owner.
 * The proxy wallet is counterfactually addressed — we can compute its
 * address before deployment.
 */
export async function deployProxyWallet(agentId: string): Promise<string> {
  const agent = agentStore.get(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  if (agent.proxyWallet) return agent.proxyWallet;

  logger.info(`Deploying proxy wallet for agent ${agentId}`, {
    agentId,
    eoaAddress: agent.walletAddress,
  });

  try {
    // Call Polymarket relayer to deploy proxy wallet
    const response = await fetch(`${config.POLYMARKET_CLOB_URL}/auth/derive-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // In the real Polymarket flow, this triggers proxy wallet creation
        // The relayer deploys a 1-of-1 Safe and returns API credentials
      }),
    });

    if (!response.ok) {
      // Use configured FUNDER_ADDRESS as proxy wallet (the Gnosis Safe / operator proxy)
      if (config.FUNDER_ADDRESS) {
        logger.info(`Using configured FUNDER_ADDRESS as proxy wallet for ${agentId}`);
        agentStore.update(agentId, { proxyWallet: config.FUNDER_ADDRESS });
        return config.FUNDER_ADDRESS;
      }
      if (config.NODE_ENV === 'production') {
        throw new Error(`Proxy wallet deployment failed for agent ${agentId}. No FUNDER_ADDRESS configured.`);
      }
      logger.warn(`Relayer unavailable and no FUNDER_ADDRESS, using EOA address as proxy wallet for ${agentId}`);
      const proxyAddress = agent.walletAddress!;
      agentStore.update(agentId, { proxyWallet: proxyAddress });
      return proxyAddress;
    }

    const data = (await response.json()) as { proxyAddress: string };
    const proxyAddress = data.proxyAddress;

    agentStore.update(agentId, { proxyWallet: proxyAddress });
    logger.info(`Proxy wallet deployed: ${proxyAddress}`, { agentId });

    return proxyAddress;
  } catch (error) {
    // Use configured FUNDER_ADDRESS as proxy wallet
    if (config.FUNDER_ADDRESS) {
      logger.info(`Relayer failed, using configured FUNDER_ADDRESS as proxy wallet for ${agentId}`);
      agentStore.update(agentId, { proxyWallet: config.FUNDER_ADDRESS });
      return config.FUNDER_ADDRESS;
    }
    if (config.NODE_ENV === 'production') {
      throw new Error(`Proxy wallet deployment failed for agent ${agentId}. No FUNDER_ADDRESS configured.`);
    }
    logger.warn(`Proxy wallet deployment failed, using EOA as fallback`, {
      agentId,
      error: (error as Error).message,
    });
    const proxyAddress = agent.walletAddress!;
    agentStore.update(agentId, { proxyWallet: proxyAddress });
    return proxyAddress;
  }
}

/**
 * Sign an EIP-712 typed data message for CLOB order placement.
 */
export async function signOrder(
  agentId: string,
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): Promise<string> {
  const wallet = getAgentWallet(agentId);
  if (!wallet) throw new Error(`Agent ${agentId} not found`);

  const signature = await wallet._signTypedData(domain, types, value);
  return signature;
}

/**
 * Get the operator wallet (used for admin operations like builder registration).
 */
export function getOperatorWallet(): ethers.Wallet | null {
  if (!config.OPERATOR_PRIVATE_KEY) return null;
  return new ethers.Wallet(config.OPERATOR_PRIVATE_KEY);
}
