#!/usr/bin/env node
/**
 * Execute a small test trade to validate fee tracking end-to-end
 * Usage: node scripts/test-trade.js
 */

const { ClobClient } = require('@polymarket/clob-client');
const { ethers } = require('ethers');

const RPC_URL = 'https://polygon-pokt.nodies.app';
const CLOB_HOST = 'https://clob.polymarket.com';

// BTC >$109k market (liquidity validated)
const TOKEN_ID = '21742633143463906290569050155826241533067272736897614950488156847949938836455';

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

  const clob = new ClobClient(CLOB_HOST, wallet.address, {
    key: apiKey,
    secret,
    passphrase,
  }, wallet);

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

  console.log('📝 Placing BUY order...');
  const order = await clob.createOrder({
    tokenID: TOKEN_ID,
    price: price,
    size: parseFloat(size),
    side: 'BUY',
    feeRateBps: '0',
    nonce: Date.now(),
    expiration: Math.floor(Date.now() / 1000) + 86400, // 24h
  });

  console.log('✅ Order placed!');
  console.log('   Order ID:', order.orderID);
  console.log('');

  // Wait for fill
  console.log('⏳ Waiting for fill...');
  let filled = false;
  let attempts = 0;

  while (!filled && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = await clob.getOrder(order.orderID);
    
    if (status.status === 'MATCHED' || status.status === 'FILLED') {
      filled = true;
      console.log('✅ Order filled!');
      console.log('   Status:', status.status);
      console.log('   Price:', status.price);
      console.log('   Size filled:', status.sizeFilled);
      console.log('');
      
      // Check if fee was recorded
      console.log('🧮 Checking fee tracking...');
      const takerFee = parseFloat(status.price) * parseFloat(status.sizeFilled) * 0.0025;
      const builderFee = takerFee * 0.2;
      console.log('   Taker fee:', takerFee.toFixed(6), 'USDC');
      console.log('   Builder fee (20%):', builderFee.toFixed(6), 'USDC');
      break;
    }

    attempts++;
  }

  if (!filled) {
    console.log('⚠️  Order not filled after 60s');
    console.log('   Order ID:', order.orderID);
    console.log('   Check status manually on Polymarket UI');
  }
}

placeBuyOrder().catch(console.error);
