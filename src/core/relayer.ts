import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { Wallet, providers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Polymarket Builder Relayer Client for gasless operations
 * Handles Safe deployment, token approvals, and meta-transactions
 */

const RELAYER_URL = 'https://relayer.polymarket.com';
const POLYGON_CHAIN_ID = 137;

let relayerClient: RelayClient | null = null;

/**
 * Initialize RelayerClient with EOA signer and builder authentication
 */
export async function initializeRelayer(eoaSigner: Wallet): Promise<RelayClient> {
  if (relayerClient) {
    return relayerClient;
  }

  try {
    // Builder config for remote signing (enables builder attribution)
    const builderConfig = new BuilderConfig({
      remoteBuilderConfig: {
        url: config.REMOTE_SIGNING_URL || 'https://polygent.market/sign'
      }
    });

    // Initialize RelayClient (handles Safe deployment + gasless approvals)
    relayerClient = new RelayClient(
      RELAYER_URL,
      POLYGON_CHAIN_ID,
      eoaSigner,
      builderConfig
    );

    logger.info('✅ RelayerClient initialized', {
      relayerUrl: RELAYER_URL,
      chainId: POLYGON_CHAIN_ID,
      eoaAddress: eoaSigner.address
    });

    return relayerClient;
  } catch (err) {
    logger.error('Failed to initialize RelayerClient', { error: err });
    throw new Error(`RelayerClient initialization failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

/**
 * Get current RelayerClient instance (must be initialized first)
 */
export function getRelayer(): RelayClient {
  if (!relayerClient) {
    throw new Error('RelayerClient not initialized. Call initializeRelayer() first.');
  }
  return relayerClient;
}

/**
 * Derive deterministic Safe address from EOA
 */
export function deriveSafeAddress(eoaAddress: string): string {
  const { deriveSafe } = require('@polymarket/builder-relayer-client/dist/builder/derive');
  const { getContractConfig } = require('@polymarket/builder-relayer-client/dist/config');

  try {
    const config = getContractConfig(POLYGON_CHAIN_ID);
    return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
  } catch (err) {
    logger.error('Failed to derive Safe address', { eoaAddress, error: err });
    throw new Error(`Safe address derivation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

/**
 * Check if Safe is deployed
 */
export async function isSafeDeployed(safeAddress: string): Promise<boolean> {
  const relayer = getRelayer();

  try {
    const deployed = await (relayer as any).getDeployed(safeAddress);
    return deployed;
  } catch (err) {
    logger.warn('Safe deployment check failed (API)', { safeAddress, error: err });

    // Fallback to RPC check
    const provider = new providers.JsonRpcProvider(config.RPC_URL);
    const code = await provider.getCode(safeAddress);
    return code !== '0x' && code.length > 2;
  }
}

/**
 * Deploy Safe wallet (gasless via relayer)
 */
export async function deploySafe(): Promise<string> {
  const relayer = getRelayer();

  try {
    logger.info('🚀 Deploying Safe (gasless via relayer)...');
    const response = await relayer.deploy();
    const result = await response.wait();

    if (!result) {
      throw new Error('Safe deployment returned no result');
    }

    logger.info('✅ Safe deployed', { proxyAddress: result.proxyAddress });
    return result.proxyAddress;
  } catch (err) {
    logger.error('Safe deployment failed', { error: err });
    throw new Error(`Safe deployment failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

/**
 * Set token approvals via relayer (gasless)
 */
export async function setTokenApprovals(safeAddress: string): Promise<void> {
  const relayer = getRelayer();
  const { ApprovalType } = require('@polymarket/builder-relayer-client');

  const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
  const EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

  try {
    logger.info('📝 Setting USDC.e approval (gasless)...');
    const usdcApproval = await relayer.approve({
      tokenAddress: USDC_E,
      spender: CTF,
      amount: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // MaxUint256
    });
    await usdcApproval.wait();

    logger.info('📝 Setting CTF approval (gasless)...');
    const ctfApproval = await relayer.approve({
      tokenAddress: CTF,
      spender: EXCHANGE,
      approvalType: ApprovalType.SetApprovalForAll,
    });
    await ctfApproval.wait();

    logger.info('✅ Token approvals set', { safeAddress });
  } catch (err) {
    logger.error('Token approval failed', { safeAddress, error: err });
    throw new Error(`Token approval failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

/**
 * Redeem CTF positions (merge outcome tokens back to USDC.e)
 * Used for closing positions when CLOB SELL orders fail
 */
export async function redeemPositions(
  tokenIds: string[],
  amounts: string[]
): Promise<string> {
  const relayer = getRelayer();

  if (tokenIds.length !== amounts.length) {
    throw new Error('tokenIds and amounts arrays must have same length');
  }

  try {
    logger.info('🔄 Redeeming CTF positions (merge to USDC.e)...', {
      positions: tokenIds.length
    });

    const response = await relayer.redeemPositions({
      tokenIds,
      amounts
    });

    const result = await response.wait();

    if (!result) {
      throw new Error('Redeem returned no result');
    }

    logger.info('✅ Positions redeemed', {
      txHash: result.transactionHash,
      positions: tokenIds.length
    });

    return result.transactionHash;
  } catch (err) {
    logger.error('Position redemption failed', { tokenIds, amounts, error: err });
    throw new Error(`Position redemption failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

/**
 * Get Safe wallet balance (USDC.e)
 */
export async function getSafeBalance(safeAddress: string): Promise<string> {
  const provider = new providers.JsonRpcProvider(config.RPC_URL);
  const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

  const usdc = new (require('ethers').Contract)(USDC_E, ERC20_ABI, provider);
  const balance = await usdc.balanceOf(safeAddress);

  return balance.toString();
}

/**
 * Cleanup RelayerClient instance
 */
export function clearRelayer(): void {
  relayerClient = null;
  logger.info('RelayerClient cleared');
}
