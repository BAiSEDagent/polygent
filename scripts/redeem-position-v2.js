#!/usr/bin/env node
/**
 * Programmatic CTF redemption with market metadata caching
 * Fully autonomous exit — no manual UI required
 */

const { ethers } = require('ethers');
const path = require('path');

// Import from compiled TypeScript
const projectRoot = path.join(__dirname, '..');
const { getMarketMetadata } = require(path.join(projectRoot, 'dist/services/market-metadata'));
const { getDb } = require(path.join(projectRoot, 'dist/core/db'));

const RPC_URL = process.env.RPC_URL || 'https://polygon-pokt.nodies.app';
const TOKEN_ID = '58858731796442679222989272055454043286056057669744610936854497026401512278651';

const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

async function redeemPosition() {
  const pk = process.env.PK || process.env.PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error('PK, PRIVATE_KEY, or OPERATOR_PRIVATE_KEY env var required');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('🔍 Wallet:', wallet.address);
  console.log('');

  // Check position balance
  const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
  const ctf = new ethers.Contract(CTF_ADDRESS, ERC1155_ABI, provider);
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

  // Fetch market metadata
  console.log('🔍 Fetching market metadata...');
  const metadata = await getMarketMetadata(TOKEN_ID);

  if (!metadata) {
    throw new Error('Market metadata not found. Token may be from a closed/inactive market.');
  }

  console.log('✅ Market metadata retrieved:');
  console.log('   Question:', metadata.question);
  console.log('   Condition ID:', metadata.conditionId);
  console.log('   Index Set:', metadata.indexSet);
  console.log('   Outcomes:', metadata.outcomes.join(', '));
  console.log('');

  // Redeem via CTF contract
  const CTF_ABI = [
    'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external'
  ];
  const ctfContract = new ethers.Contract(CTF_ADDRESS, CTF_ABI, wallet);

  console.log('🔄 Redeeming position (merge to USDC.e)...');
  console.log('   This calls CTF.redeemPositions() directly');
  console.log('');

  try {
    const tx = await ctfContract.redeemPositions(
      USDC_E,
      metadata.parentCollectionId,
      metadata.conditionId,
      [metadata.indexSet]
    );

    console.log('⏳ Transaction submitted:', tx.hash);
    console.log('   Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Position redeemed!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas used:', receipt.gasUsed.toString());
    console.log('');

    // Check USDC.e balance after redemption
    const usdcAfter = await usdc.balanceOf(wallet.address);
    const received = usdcAfter.sub(usdcBefore);

    console.log('💰 USDC.e after:', ethers.utils.formatUnits(usdcAfter, 6));
    console.log('📈 Received:', ethers.utils.formatUnits(received, 6), 'USDC.e');
    console.log('');
    console.log('✅ Exit complete (fully autonomous, no UI required)');
    console.log('🎯 Transaction:', `https://polygonscan.com/tx/${receipt.transactionHash}`);

  } catch (err) {
    console.error('❌ Redemption failed:', err.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('- Ensure market is settled (only settled markets can redeem)');
    console.error('- Check if position is from an active market');
    console.error('- Verify sufficient POL for gas (~$0.01)');
    throw err;
  }
}

redeemPosition().catch(console.error);
