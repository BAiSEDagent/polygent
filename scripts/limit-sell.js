#!/usr/bin/env node
/**
 * Place limit SELL order at specified price
 */

const { ClobClient } = require('@polymarket/clob-client');
const { ethers } = require('ethers');

const RPC_URL = 'https://polygon-pokt.nodies.app';
const CLOB_HOST = 'https://clob.polymarket.com';
const TOKEN_ID = '58858731796442679222989272055454043286056057669744610936854497026401512278651';

async function limitSell() {
  const pk = process.env.PK || process.env.PRIVATE_KEY;
  const apiKey = process.env.CLOB_API_KEY;
  const secret = process.env.CLOB_SECRET;
  const passphrase = process.env.CLOB_PASSPHRASE;

  if (!pk) throw new Error('PK or PRIVATE_KEY env var required');
  if (!apiKey || !secret || !passphrase) throw new Error('CLOB credentials missing');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('🔍 Wallet:', wallet.address);
  console.log('');

  const clob = new ClobClient(CLOB_HOST, 137, wallet, {
    key: apiKey,
    secret,
    passphrase,
  });

  // Check position
  const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
  const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
  const ctf = new ethers.Contract(CTF, ERC1155_ABI, provider);
  const balance = await ctf.balanceOf(wallet.address, TOKEN_ID);
  const shares = parseFloat(ethers.utils.formatUnits(balance, 6));

  console.log('📊 Position:', shares.toFixed(3), 'shares');

  // Get order book for context
  const book = await clob.getOrderBook(TOKEN_ID);
  console.log('📊 Best bid:', book.bids[0]?.price || 'none');
  console.log('   Best ask:', book.asks[0]?.price || 'none');
  console.log('');

  // Limit sell at 0.50 (mid-market between 0.001 bid and 0.999 ask)
  const sellPrice = 0.50;
  const sellSize = shares;

  console.log('📝 Placing limit SELL @ $' + sellPrice);
  console.log('   Size:', sellSize.toFixed(3), 'shares');
  console.log('   Value: $' + (sellSize * sellPrice).toFixed(2));
  console.log('');

  const orderPayload = await clob.createOrder({
    tokenID: TOKEN_ID,
    price: sellPrice,
    size: parseFloat(sellSize.toFixed(3)),
    side: 'SELL',
    feeRateBps: '0',
    expiration: 0, // GTC
  });

  console.log('📤 Payload:');
  console.log('   Side:', orderPayload.side);
  console.log('   SignatureType:', orderPayload.signatureType);
  console.log('   MakerAmount:', orderPayload.makerAmount, '(outcome tokens)');
  console.log('   TakerAmount:', orderPayload.takerAmount, '(USDC)');
  console.log('');

  const order = await clob.postOrder(orderPayload);

  if (order.success) {
    console.log('✅ Limit SELL placed!');
    console.log('   Order ID:', order.orderID);
    console.log('   Status:', order.status);
    if (order.transactionsHashes) {
      console.log('   TX:', order.transactionsHashes[0]);
    }
  } else {
    console.log('❌ Order failed:', order.errorMsg || order.error);
    console.log('Full response:', JSON.stringify(order, null, 2));
  }
}

limitSell().catch(console.error);
