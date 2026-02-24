#!/usr/bin/env node
/**
 * Record the manual test trade ($1.01) into the database
 * This allows builder fee tracking to work for trades placed outside the agent system
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'polygent.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = OFF'); // Disable FK checks for manual entry

// Transaction details from test-trade.js execution
const tradeData = {
  id: '0x269992ed7547a260f23b669240e4777144ef5415450afe638fe2309945a5ba2e',
  order_id: '0x269992ed7547a260f23b669240e4777144ef5415450afe638fe2309945a5ba2e',
  agent_id: 'manual_test',
  market_id: '58858731796442679222989272055454043286056057669744610936854497026401512278651',
  side: 'BUY',
  outcome: 'YES',
  amount: 1.011,
  price: 0.999,
  source: 'manual',
  timestamp: 1771970481 // Feb 24, 2026 22:01:21 UTC
};

try {
  // Insert order first (trades table has FK constraint)
  const insertOrder = db.prepare(`
    INSERT OR IGNORE INTO orders (id, agent_id, market_id, side, outcome, amount, price, status, filled_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertOrder.run(
    tradeData.order_id,
    tradeData.agent_id,
    tradeData.market_id,
    tradeData.side,
    tradeData.outcome,
    tradeData.amount,
    tradeData.price,
    'FILLED',
    tradeData.amount,
    tradeData.timestamp,
    tradeData.timestamp
  );

  // Insert trade
  const insertTrade = db.prepare(`
    INSERT OR IGNORE INTO trades (id, order_id, agent_id, market_id, side, outcome, amount, price, source, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertTrade.run(
    tradeData.id,
    tradeData.order_id,
    tradeData.agent_id,
    tradeData.market_id,
    tradeData.side,
    tradeData.outcome,
    tradeData.amount,
    tradeData.price,
    tradeData.source,
    tradeData.timestamp
  );

  if (result.changes > 0) {
    console.log('✅ Trade recorded in database');
    console.log('   Trade ID:', tradeData.id);
    console.log('   Notional: $' + (tradeData.amount * tradeData.price).toFixed(2));
    console.log('');

    // Calculate and record builder fee
    const notional = tradeData.amount * tradeData.price;
    const takerFee = notional * 0.0025; // 0.25% fee
    const builderShare = 0.20; // 20% of taker fees
    const builderFee = takerFee * builderShare;

    const insertFee = db.prepare(`
      INSERT INTO builder_fees (trade_id, fee_usd, timestamp_ms, source)
      VALUES (?, ?, ?, ?)
    `);

    insertFee.run(
      tradeData.id,
      builderFee,
      tradeData.timestamp * 1000,
      'manual_backfill'
    );

    console.log('✅ Builder fee recorded');
    console.log('   Taker fee:', takerFee.toFixed(6), 'USDC');
    console.log('   Builder fee (20%):', builderFee.toFixed(6), 'USDC');
    console.log('');
    console.log('🎯 Check dashboard: https://polygent.market');
  } else {
    console.log('ℹ️  Trade already exists in database');
  }
} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
