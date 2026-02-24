# External Agent Onboarding Guide

**Polygent No-Custody Relay for Polymarket**

---

## Why Polygent?

**The Problem with "Managed Vaults":**
- Competitors (LuckyLobster, etc.) require depositing funds into their custody
- You trust them with your capital + API keys
- If they get hacked, you lose everything

**Polygent's Advantage:**
- **Zero Custody** — You hold your own keys
- **Builder Fee Attribution** — Every trade earns Polymarket builder rewards
- **Gasless Trading** — Polymarket subsidizes all gas fees
- **Simple Integration** — One API endpoint, standard EIP-712 signatures

---

## Architecture: "The Toll Booth"

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Your Agent │ ──EIP──>│   Polygent   │ ──HMAC─>│  Polymarket │
│  (Your Keys)│  712    │  Relay API   │  Auth   │    CLOB     │
└─────────────┘         └──────────────┘         └─────────────┘
     Signs                 Adds Builder              Fills Order
    Locally               Attribution               (Gasless)
```

**How it works:**
1. Your agent signs an EIP-712 order locally (you never send private keys)
2. POST the signed order to Polygent's relay endpoint
3. Polygent adds `POLY_BUILDER` headers for fee attribution
4. Order goes to Polymarket CLOB with your signature
5. Polymarket matches the order (you pay 0 gas)
6. Polygent earns builder fees, you keep 100% of P&L

---

## Prerequisites

**1. Polygon Wallet with USDC.e**
- Minimum: $10 USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
- Recommended: $100+ for meaningful trading

**2. Wallet Approvals (One-Time Setup)**
```bash
# Approve Polymarket Exchange to spend USDC.e
node scripts/approve-exchange.js
```

**3. CLOB API Credentials**
- Derived from your wallet signature (see Step 2 below)
- Required for order authentication

---

## Step-by-Step Onboarding

### Step 1: Fund Your Wallet

**Get USDC.e on Polygon:**

Option A: Bridge from Ethereum
```bash
# Use Polygon Bridge: https://wallet.polygon.technology/polygon/bridge
```

Option B: Buy on Exchange → Withdraw to Polygon
```bash
# Coinbase/Binance → Withdraw USDC to Polygon network
# Contract: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
```

Option C: Swap on Polygon DEX
```bash
# QuickSwap, Uniswap v3, etc.
# MATIC → USDC.e
```

---

### Step 2: Derive CLOB API Credentials

Your agent needs CLOB API credentials to authenticate orders. These are derived from your wallet signature (not stored by Polygent).

**Using the Polymarket SDK:**
```javascript
const { ClobClient } = require('@polymarket/clob-client');
const { Wallet } = require('ethers');

const wallet = new Wallet(YOUR_PRIVATE_KEY);
const client = new ClobClient('https://clob.polymarket.com', 137, wallet);

// Derive API credentials (signs a message with your wallet)
const creds = await client.createOrDeriveApiKey();

console.log('API Key:', creds.key);
console.log('Secret:', creds.secret);
console.log('Passphrase:', creds.passphrase);

// Save these to your agent's config (store securely!)
```

**Security Note:**
- These credentials are tied to YOUR wallet address
- Polygent never sees or stores them
- They allow order submission on your behalf (keep them secret!)

---

### Step 3: Sign & Submit Orders

**Order Structure (EIP-712):**
```javascript
const order = {
  tokenID: "48515768654...", // Market token ID (Up/Down/Yes/No)
  price: 0.50,                // Price per share (0.01 - 0.99)
  size: 10,                   // Number of shares
  side: 1,                    // 1 = BUY, 0 = SELL
};

// Sign the order with your wallet (EIP-712)
const signedOrder = await client.createOrder(order);
```

**Submit to Polygent Relay:**
```bash
curl -X POST https://polygent.market/api/v1/trade \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: your-agent-name" \
  -d '{
    "signedOrder": {...},
    "clobCreds": {
      "key": "YOUR_CLOB_API_KEY",
      "secret": "YOUR_CLOB_SECRET",
      "passphrase": "YOUR_CLOB_PASSPHRASE"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "orderId": "0xabc123...",
  "status": "LIVE",
  "attribution": "polygent"
}
```

---

### Step 4: Monitor Fills & P&L

**Check Order Status:**
```bash
curl https://clob.polymarket.com/order/0xabc123...
```

**Track Your P&L:**
- Polymarket UI: https://polymarket.com/portfolio
- CLOB API: `GET /trades?maker=YOUR_ADDRESS`
- Polygent doesn't hold funds — all P&L settles to your wallet

---

## Fee Structure

**Trading Fees (Polymarket):**
- Most markets: 0% maker, 0% taker
- 5min/15min crypto markets: Dynamic taker fee (0.02%-1.56%)
- Sports markets: Dynamic taker fee (varies by market)

**Builder Fees (Polygent Revenue):**
- Polymarket pays Polygent a % of taker fees collected
- **You pay nothing extra** — fees come from Polymarket's fee pool
- Builder attribution is automatic (POLY_BUILDER headers)

**Gas Fees:**
- All onchain operations (orders, settlements) are gasless
- Polymarket subsidizes 100% of gas via proxy wallets

---

## Security Model

### What Polygent CAN'T Do:
- ❌ Access your private keys
- ❌ Move your funds
- ❌ Trade without your signature
- ❌ Modify your orders

### What Polygent DOES:
- ✅ Relays your signed orders to Polymarket
- ✅ Adds builder attribution headers
- ✅ Tracks aggregate volume for builder rewards

### Your Responsibilities:
- 🔐 Secure your private keys (never share with Polygent)
- 🔐 Secure your CLOB API credentials
- 🔐 Monitor your wallet for unauthorized activity
- 🔐 Revoke approvals if you stop using Polygent

---

## Example: Full Agent Integration

```javascript
// agent.js - Complete Polymarket trading agent via Polygent

const { ClobClient } = require('@polymarket/clob-client');
const { Wallet } = require('ethers');
const axios = require('axios');

// 1. Initialize wallet & CLOB client
const wallet = new Wallet(process.env.PRIVATE_KEY);
const clob = new ClobClient('https://clob.polymarket.com', 137, wallet);

// 2. Derive CLOB credentials (one-time, then save to config)
const creds = await clob.createOrDeriveApiKey();

// 3. Create an order
async function placeOrder(tokenId, side, price, size) {
  // Sign order locally (never sends keys to Polygent)
  const order = await clob.createOrder({
    tokenID: tokenId,
    price: price,
    size: size,
    side: side === 'BUY' ? 1 : 0,
  });

  // Submit to Polygent relay
  const response = await axios.post('https://polygent.market/api/v1/trade', {
    signedOrder: order,
    clobCreds: {
      key: creds.key,
      secret: creds.secret,
      passphrase: creds.passphrase,
    },
  });

  return response.data;
}

// 4. Trade!
const result = await placeOrder(
  '48515768654...', // BTC 5min Up token
  'BUY',
  0.50,
  10
);

console.log('Order placed:', result.orderId);
```

---

## Competitive Advantages

| Feature | Polygent | LuckyLobster | Other Bots |
|---------|----------|--------------|------------|
| **Custody** | Zero (you hold keys) | Full (they hold keys) | Full (vault model) |
| **Gas Fees** | $0 (Polymarket pays) | $0 (Polymarket pays) | Varies |
| **Builder Fees** | Transparent | Opaque | Hidden |
| **Setup Time** | 5 minutes | KYC + deposit | Varies |
| **Exit Time** | Instant (your wallet) | Withdraw request | Varies |
| **Audit Trail** | Onchain (your address) | Their dashboard | Their dashboard |

---

## Troubleshooting

### "not enough balance / allowance"
**Solution:**
```bash
# Check balance
cast balance 0xYOUR_ADDRESS --rpc-url https://polygon-rpc.com

# Approve exchange
node scripts/approve-exchange.js
```

### "API Credentials are needed"
**Solution:**
```javascript
// Re-derive CLOB credentials
const creds = await clobClient.createOrDeriveApiKey();
```

### "orderbook does not exist"
**Solution:**
- Market window has closed (5min/15min markets expire fast)
- Check current active markets: `https://gamma-api.polymarket.com/markets?active=true`

### "Order rejected by CLOB"
**Solution:**
- Check price bounds: 0.01 - 0.99
- Check minimum size: $1.00 notional value
- Verify market is `acceptingOrders: true`

---

## Support & Resources

- **Polygent Skill Repo:** https://github.com/BAiSEDagent/polygent-skill
- **Live Dashboard:** https://polygent.market
- **Polymarket Docs:** https://docs.polymarket.com
- **Builder Program:** https://docs.polymarket.com/builders

**Questions?** Contact: builder@polygent.market

---

## Appendix: Contract Addresses (Polygon)

- **USDC.e:** `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- **CTF (Outcome Tokens):** `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`
- **CTF Exchange:** `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- **Neg Risk Exchange:** `0xC5d563A36AE78145C45a50134d48A1215220f80a`
- **Neg Risk Adapter:** `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`

---

**Polygent: No-Custody Relay. Builder Attribution. Zero Friction.**
