#!/usr/bin/env node
/**
 * Execute a small test trade to validate fee tracking end-to-end
 * Usage: node scripts/test-trade.js
 */

const { ClobClient } = require('@polymarket/clob-client');
const { ethers } = require('ethers');

const RPC_URL = 'https://polygon-pokt.nodies.app';
const CLOB_HOST = 'https://clob.polymarket.com';

// Active liquid market: "Will Trump sell 10k-25k Gold Cards in 2026?" (YES token)
const TOKEN_ID = '58858731796442679222989272055454043286056057669744610936854497026401512278651';

async function placeBuyOrder() {
  const pk = process.env.PK || process.env.PRIVATE_KEY;
  const apiKey = process.env.CLOB_API_KEY;
  const secret = process.env.CLOB_SECRET;
  const passphrase = process.env.CLOB_PASSPHRASE;

  if (!pk) throw new Error('PK or PRIVATE_KEY env var required');
  if (!apiKey || !secret || !passphrase) throw new Error('CLOB credentials missing');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('🔍 Wallet:', wallet.address);
  console.log('🎯 Market: BTC >$109k (token ID:', TOKEN_ID, ')');
  console.log('');

  const clob = new ClobClient(CLOB_HOST, 137, wallet, {
    key: apiKey,
    secret,
    passphrase,
  });

  // Place BUY order for $1.00 notional at current best ask
  console.log('📊 Fetching order book...');
  const book = await clob.getOrderBook(TOKEN_ID);
  const bestAsk = book.asks[0];
  if (!bestAsk) throw new Error('No asks available');

  const price = parseFloat(bestAsk.price);
  const size = (1.0 / price).toFixed(2); // $1 notional

  console.log('   Best ask:', price);
  console.log('   Size:', size, 'shares (~$1.00 notional)');
  console.log('');

  console.log('📝 Building order payload...');
  const orderPayload = await clob.createOrder({
    tokenID: TOKEN_ID,
    price: price,
    size: parseFloat(size),
    side: 'BUY',
    feeRateBps: '0',
    nonce: Date.now(),
    expiration: Math.floor(Date.now() / 1000) + 86400, // 24h
  });

  console.log('📤 Submitting order to matching engine...');
  console.log('Payload:', JSON.stringify(orderPayload, null, 2));
  const order = await clob.postOrder(orderPayload);

  console.log('✅ POST response:', JSON.stringify(order, null, 2));
  
  // Check if order was created via API
  await new Promise(resolve => setTimeout(resolve, 2000));
  const response = await fetch(`https://clob.polymarket.com/data/orders?maker=${wallet.address}`, {
    headers: { 'Accept': 'application/json' }
  });
  const { data: orders } = await response.json();
  
  if (orders && orders.length > 0) {
    const latest = orders[orders.length - 1];
    console.log('Latest order from API:');
    console.log('   Order ID:', latest.id);
    console.log('   Status:', latest.status);
    console.log('   Price:', latest.price);
    console.log('   Size:', latest.size);
    console.log('');

    if (latest.status === 'MATCHED' || latest.status === 'FILLED') {
      console.log('✅ Order filled!');
      const takerFee = parseFloat(latest.price) * parseFloat(latest.size_matched || latest.size) * 0.0025;
      const builderFee = takerFee * 0.2;
      console.log('🧮 Taker fee:', takerFee.toFixed(6), 'USDC');
      console.log('   Builder fee (20%):', builderFee.toFixed(6), 'USDC');
    } else {
      console.log('⚠️  Order status:', latest.status);
      console.log('   Check https://polymarket.com');
    }
  } else {
    console.log('⚠️  No orders found');
  }
}

placeBuyOrder().catch(console.error);
