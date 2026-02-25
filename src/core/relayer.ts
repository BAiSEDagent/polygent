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
 * 
 * @param tokenId - Outcome token ID
 * @param amount - Amount to redeem (in wei, e.g., "1000000" for 1 share)
 * @returns Transaction hash
 */
export async function redeemPosition(
  tokenId: string,
  amount: string
): Promise<string> {
  const { getMarketMetadata } = await import('../services/market-metadata');
  const { ethers } = require('ethers');
  const { config } = await import('../config');

  try {
    logger.info('🔄 Fetching market metadata for redemption...', { tokenId });

    // Get market metadata from cache or API
    const metadata = await getMarketMetadata(tokenId);
    if (!metadata) {
      throw new Error(`Market metadata not found for token ${tokenId}`);
    }

    logger.info('📊 Market metadata retrieved', {
      conditionId: metadata.conditionId,
      indexSet: metadata.indexSet,
      question: metadata.question
    });

    // Get wallet and CTF contract
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.OPERATOR_PRIVATE_KEY || '', provider);

    const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
    const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

    const CTF_ABI = [
      'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external'
    ];

    const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, wallet);

    // Call CTF.redeemPositions
    logger.info('📤 Submitting redemption transaction...');
    const tx = await ctf.redeemPositions(
      USDC_E,
      metadata.parentCollectionId,
      metadata.conditionId,
      [metadata.indexSet]
    );

    logger.info('⏳ Waiting for confirmation...', { txHash: tx.hash });
    const receipt = await tx.wait();

    logger.info('✅ Position redeemed', {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

    return receipt.transactionHash;
  } catch (err) {
    logger.error('Position redemption failed', { tokenId, amount, error: err });
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
