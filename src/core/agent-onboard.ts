import { createWalletClient, http, Hex, encodeFunctionData, maxUint256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig, BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';
import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Agent Onboarding Service
 *
 * Handles the full onboarding flow for external agents:
 * 1. Deploy Gnosis Safe (gasless via Polymarket relayer)
 * 2. Set token approvals (USDC.e, CTF, Exchange, NegRisk)
 * 3. Derive CLOB API credentials
 *
 * After onboarding, the agent can trade through our builder attribution.
 * Zero gas cost — Polymarket covers everything.
 */

// Polymarket contract addresses on Polygon
const CONTRACTS = {
  USDC_E: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
  RELAYER_URL: 'https://relayer-v2.polymarket.com/',
};

const ERC20_APPROVE_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ERC1155 setApprovalForAll for CTF outcome tokens
const ERC1155_APPROVAL_ABI = [
  {
    constant: false,
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface OnboardResult {
  success: boolean;
  safeAddress?: string;
  approvalsTxHash?: string;
  clobCreds?: {
    apiKey: string;
    secret: string;
    passphrase: string;
  };
  error?: string;
}

/**
 * Create a RelayClient for a given agent's private key.
 * Uses OUR builder credentials for attribution.
 */
function createRelayClient(agentPk: Hex): RelayClient {
  const account = privateKeyToAccount(agentPk);
  const wallet = createWalletClient({
    account,
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
  });

  const builderCreds: BuilderApiKeyCreds = {
    key: config.BUILDER_API_KEY,
    secret: config.BUILDER_SECRET,
    passphrase: config.BUILDER_PASSPHRASE,
  };

  const builderConfig = new BuilderConfig({
    localBuilderCreds: builderCreds,
  });

  return new RelayClient(
    CONTRACTS.RELAYER_URL,
    137,
    wallet,
    builderConfig,
  );
}

/**
 * Deploy a Gnosis Safe for an agent. Gasless — Polymarket pays.
 * Returns the Safe address.
 */
export async function deploySafe(agentPk: Hex): Promise<{ safeAddress: string; txHash: string }> {
  const client = createRelayClient(agentPk);

  logger.info('Deploying Gnosis Safe for agent...');
  const response = await client.deploy();
  const result = await response.wait();

  if (!result || !result.proxyAddress) {
    throw new Error('Safe deployment failed — no proxy address returned');
  }

  logger.info(`Safe deployed: ${result.proxyAddress} (tx: ${result.transactionHash})`);
  return {
    safeAddress: result.proxyAddress,
    txHash: result.transactionHash,
  };
}

/**
 * Set all required token approvals for trading. Gasless batch transaction.
 *
 * Approvals needed:
 * - USDC.e → CTF Exchange (for buying)
 * - USDC.e → Neg Risk CTF Exchange (for neg risk markets)
 * - CTF → CTF Exchange (for selling outcome tokens)
 * - CTF → Neg Risk CTF Exchange
 * - CTF → Neg Risk Adapter
 */
export async function setApprovals(agentPk: Hex): Promise<string> {
  const client = createRelayClient(agentPk);

  // USDC.e approvals
  const approveUsdcCtfExchange = {
    to: CONTRACTS.USDC_E as `0x${string}`,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [CONTRACTS.CTF_EXCHANGE as `0x${string}`, maxUint256],
    }),
    value: '0',
  };

  const approveUsdcNegRisk = {
    to: CONTRACTS.USDC_E as `0x${string}`,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [CONTRACTS.NEG_RISK_CTF_EXCHANGE as `0x${string}`, maxUint256],
    }),
    value: '0',
  };

  // CTF (ERC1155) approvals
  const approveCTFExchange = {
    to: CONTRACTS.CTF as `0x${string}`,
    data: encodeFunctionData({
      abi: ERC1155_APPROVAL_ABI,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.CTF_EXCHANGE as `0x${string}`, true],
    }),
    value: '0',
  };

  const approveCTFNegRisk = {
    to: CONTRACTS.CTF as `0x${string}`,
    data: encodeFunctionData({
      abi: ERC1155_APPROVAL_ABI,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.NEG_RISK_CTF_EXCHANGE as `0x${string}`, true],
    }),
    value: '0',
  };

  const approveCTFAdapter = {
    to: CONTRACTS.CTF as `0x${string}`,
    data: encodeFunctionData({
      abi: ERC1155_APPROVAL_ABI,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.NEG_RISK_ADAPTER as `0x${string}`, true],
    }),
    value: '0',
  };

  logger.info('Setting token approvals (batch, gasless)...');
  const response = await client.execute(
    [approveUsdcCtfExchange, approveUsdcNegRisk, approveCTFExchange, approveCTFNegRisk, approveCTFAdapter],
    'Polygent: batch token approvals for trading',
  );
  const result = await response.wait();

  if (!result?.transactionHash) {
    throw new Error('Approval transaction failed');
  }

  logger.info(`Approvals set (tx: ${result.transactionHash})`);
  return result.transactionHash;
}

/**
 * Derive CLOB API credentials for an agent.
 * Uses the agent's own signer — creds belong to them.
 */
export async function deriveClobCreds(agentPk: string): Promise<{
  apiKey: string;
  secret: string;
  passphrase: string;
}> {
  const signer = new Wallet(agentPk);

  // Temporary CLOB client just for credential derivation
  const client = new ClobClient(
    'https://clob.polymarket.com',
    137,
    signer,
  );

  logger.info('Deriving CLOB API credentials...');
  const creds = await client.createOrDeriveApiKey();

  logger.info(`CLOB creds derived (key: ${creds.key.slice(0, 8)}...)`);
  return {
    apiKey: creds.key,
    secret: creds.secret,
    passphrase: creds.passphrase,
  };
}

/**
 * Full onboarding: deploy Safe → approvals → derive CLOB creds.
 * Returns everything the agent needs to start trading.
 */
export async function onboardAgent(agentPk: Hex): Promise<OnboardResult> {
  try {
    // Step 1: Deploy Safe
    const { safeAddress } = await deploySafe(agentPk);

    // Step 2: Set approvals
    const approvalsTxHash = await setApprovals(agentPk);

    // Step 3: Derive CLOB credentials
    const clobCreds = await deriveClobCreds(agentPk);

    logger.info(`Agent onboarded: Safe=${safeAddress}, ready to trade`);

    return {
      success: true,
      safeAddress,
      approvalsTxHash,
      clobCreds,
    };
  } catch (err) {
    const msg = (err as Error).message;
    logger.error(`Agent onboarding failed: ${msg}`);
    return { success: false, error: msg };
  }
}
