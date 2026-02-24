#!/usr/bin/env node
/**
 * Programmatic exit via CTF redeemPositions()
 * Merges outcome tokens back to USDC.e (bypasses CLOB SELL orders)
 */

const { RelayClient } = require('@polymarket/builder-relayer-client');
const { BuilderConfig } = require('@polymarket/builder-signing-sdk');
const { ethers } = require('ethers');

const RPC_URL = 'https://polygon-pokt.nodies.app';
const RELAYER_URL = 'https://relayer.polymarket.com';
const POLYGON_CHAIN_ID = 137;
const REMOTE_SIGNING_URL = process.env.REMOTE_SIGNING_URL || 'https://polygent.market/sign';

// Contracts
const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// Token we hold
const TOKEN_ID = '58858731796442679222989272055454043286056057669744610936854497026401512278651';

async function redeemPosition() {
  const pk = process.env.PK || process.env.PRIVATE_KEY;
  if (!pk) throw new Error('PK or PRIVATE_KEY env var required');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('🔍 Wallet:', wallet.address);
  console.log('');

  // Check position balance
  const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
  const ctf = new ethers.Contract(CTF, ERC1155_ABI, provider);
  const balance = await ctf.balanceOf(wallet.address, TOKEN_ID);
  const shares = parseFloat(ethers.utils.formatUnits(balance, 6));

  console.log('📊 Current position:', shares.toFixed(3), 'shares');

  if (shares < 0.001) {
    console.log('⚠️  No position to redeem');
    return;
  }

  // Check USDC.e balance before redemption
  const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract(USDC_E, ERC20_ABI, provider);
  const usdcBefore = await usdc.balanceOf(wallet.address);

  console.log('💰 USDC.e before:', ethers.utils.formatUnits(usdcBefore, 6));
  console.log('');

  // Initialize RelayClient
  const builderConfig = new BuilderConfig({
    remoteBuilderConfig: { url: REMOTE_SIGNING_URL }
  });

  const relayClient = new RelayClient(
    RELAYER_URL,
    POLYGON_CHAIN_ID,
    wallet,
    builderConfig
  );

  console.log('🔄 Redeeming position (merge to USDC.e)...');
  console.log('   This calls CTF.redeemPositions() via gasless relayer');
  console.log('');

  try {
    // Redeem positions (merge outcome tokens → USDC.e)
    const response = await relayClient.redeemPositions({
      tokenIds: [TOKEN_ID],
      amounts: [balance.toString()]
    });

    console.log('⏳ Waiting for transaction...');
    const result = await response.wait();

    if (!result) {
      throw new Error('Redeem returned no result');
    }

    console.log('✅ Position redeemed!');
    console.log('   TX:', result.transactionHash);
    console.log('');

    // Check USDC.e balance after redemption
    const usdcAfter = await usdc.balanceOf(wallet.address);
    const received = usdcAfter.sub(usdcBefore);

    console.log('💰 USDC.e after:', ethers.utils.formatUnits(usdcAfter, 6));
    console.log('📈 Received:', ethers.utils.formatUnits(received, 6), 'USDC.e');
    console.log('');
    console.log('✅ Exit complete (autonomous, no UI required)');

  } catch (err) {
    console.error('❌ Redemption failed:', err.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('- Ensure REMOTE_SIGNING_URL is set correctly');
    console.error('- Check builder credentials at polymarket.com/settings');
    console.error('- Verify CTF approval is set (should be from earlier setup)');
    throw err;
  }
}

redeemPosition().catch(console.error);
