#!/usr/bin/env node
/**
 * Close position by selling all shares at current bid
 */

const { ClobClient } = require('@polymarket/clob-client');
const { ethers } = require('ethers');

const RPC_URL = 'https://polygon-pokt.nodies.app';
const CLOB_HOST = 'https://clob.polymarket.com';
const TOKEN_ID = '58858731796442679222989272055454043286056057669744610936854497026401512278651';

async function closePosition() {
  const pk = process.env.PK || process.env.PRIVATE_KEY;
  const apiKey = process.env.CLOB_API_KEY;
  const secret = process.env.CLOB_SECRET;
  const passphrase = process.env.CLOB_PASSPHRASE;

  if (!pk) throw new Error('PK or PRIVATE_KEY env var required');
  if (!apiKey || !secret || !passphrase) throw new Error('CLOB credentials missing');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('🔍 Wallet:', wallet.address);
  console.log('🎯 Market: Trump Gold Cards');
  console.log('');

  const clob = new ClobClient(CLOB_HOST, 137, wallet, {
    key: apiKey,
    secret,
    passphrase,
  });

  // Check position balance
  const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
  const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
  const ctf = new ethers.Contract(CTF, ERC1155_ABI, provider);
  const balance = await ctf.balanceOf(wallet.address, TOKEN_ID);
  const shares = parseFloat(ethers.utils.formatUnits(balance, 6));

  console.log('📊 Current position:', shares.toFixed(3), 'shares');

  if (shares < 0.001) {
    console.log('⚠️  No position to close');
    return;
  }

  // Get current best bid and ask
  console.log('📊 Fetching order book...');
  const book = await clob.getOrderBook(TOKEN_ID);
  const bestBid = book.bids[0];
  const bestAsk = book.asks[0];
  
  if (!bestBid) throw new Error('No bids available');

  const bidPrice = parseFloat(bestBid.price);
  const askPrice = bestAsk ? parseFloat(bestAsk.price) : null;
  
  console.log('   Best bid:', bidPrice);
  console.log('   Best ask:', askPrice || 'none');
  
  // Use mid-market price (slightly below ask) for better fill chance
  const price = askPrice ? (bidPrice + askPrice) / 2 : bidPrice;
  
  console.log('   Sell price:', price.toFixed(3));
  console.log('   Selling:', shares.toFixed(3), 'shares');
  console.log('   Expected: $' + (shares * price).toFixed(2));
  console.log('');

  console.log('📝 Building SELL order...');
  const orderPayload = await clob.createOrder({
    tokenID: TOKEN_ID,
    price: price,
    size: parseFloat(shares.toFixed(3)),
    side: 'SELL',
    feeRateBps: '0',
    expiration: 0,
  });

  console.log('📤 Submitting to matching engine...');
  const order = await clob.postOrder(orderPayload);

  if (order.success) {
    console.log('✅ Position closed!');
    console.log('   Order ID:', order.orderID);
    console.log('   TX:', order.transactionsHashes[0]);
    console.log('   Proceeds: $' + order.takingAmount);
  } else {
    console.log('❌ Order failed:', order.errorMsg || JSON.stringify(order));
  }
}

closePosition().catch(console.error);
