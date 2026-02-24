# External Agent Onboarding Guide v2.0

**Polygent No-Custody Relay for Polymarket** — Institutional-Grade Safe Wallet Integration

---

## Why Polygent?

**The Problem with "Managed Vaults":**
- Competitors require depositing funds into their custody
- You trust them with your capital + API keys
- If they get hacked, you lose everything

**Polygent's Zero-Custody Advantage:**
- ✅ **Non-Custodial** — You hold your own keys (EOA or Safe wallet)
- ✅ **Builder Fee Attribution** — Every trade earns Polymarket builder rewards
- ✅ **Gasless Trading** — Polymarket subsidizes all gas fees via relayer
- ✅ **Institutional Support** — Gnosis Safe wallets with meta-transaction support
- ✅ **Simple Integration** — One API endpoint, standard signatures

---

## Architecture: "The Toll Booth"

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Your Agent │ ──Sign─>│   Polygent   │ ──HMAC─>│  Polymarket │
│  (Your Keys)│  Intent │  Relay API   │  Auth   │    CLOB     │
└─────────────┘         └──────────────┘         └─────────────┘
     EOA or               Adds Builder              Fills Order
   Safe Wallet            Attribution               (Gasless)
```

**How it works:**
1. Your agent signs an order intent locally (EOA or Safe multi-sig)
2. POST the signed order to Polygent's relay endpoint
3. Polygent adds `POLY_BUILDER` headers for fee attribution
4. Order goes to Polymarket CLOB with your signature
5. Polymarket matches the order (you pay 0 gas via relayer)
6. Polygent earns builder fees, you keep 100% of P&L

---

## Two Integration Paths

### Option A: EOA Wallet (Simple, Direct)

**Best for:** Solo agents, testing, quick setup

**Requirements:**
- Single private key
- Manual gas funding (small POL balance for approvals)
- Direct CLOB API access

**Setup time:** 5 minutes

---

### Option B: Safe Wallet (Institutional, Gasless)

**Best for:** Multi-sig agents, institutions, gasless onboarding

**Requirements:**
- EOA signer (to control Safe)
- **Zero gas required** (relayer pays all gas)
- Polymarket Builder Relayer for Safe deployment + approvals

**Setup time:** 10 minutes

**Advantages over EOA:**
- Gasless onboarding (no POL needed)
- Multi-sig support (optional)
- Upgradeable wallet logic
- Meta-transaction support

---

## Prerequisites

### For Both Paths:
1. **Polygon RPC endpoint** (free: Alchemy, Infura, or public)
2. **USDC.e funding** ($10+ recommended)
   - Contract: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`

### EOA Path Only:
3. **POL for gas** (~0.1 POL / $0.03 for approvals)

### Safe Path Only:
3. **Builder credentials** (from `polymarket.com/settings?tab=builder`)
4. **Remote signing endpoint** (your own or Polygent's)

---

## Quick Start: Safe Wallet Path (Recommended)

### Step 1: Install Dependencies

```bash
npm install @polymarket/builder-relayer-client \
            @polymarket/builder-signing-sdk \
            @polymarket/clob-client \
            ethers@5.7.2
```

### Step 2: Derive Safe Address

```typescript
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';

const POLYGON_CHAIN_ID = 137;
const EOA_ADDRESS = '0xYourEOA...';

// Deterministic Safe address derivation
const config = getContractConfig(POLYGON_CHAIN_ID);
const safeAddress = deriveSafe(EOA_ADDRESS, config.SafeContracts.SafeFactory);

console.log('Your Safe address:', safeAddress);
// Fund this address with USDC.e before proceeding
```

**✅ Fund this Safe address with USDC.e** ($10+) before continuing.

### Step 3: Initialize Relayer Client

```typescript
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { Wallet } from 'ethers';

const RELAYER_URL = 'https://relayer.polymarket.com';
const REMOTE_SIGNING_URL = 'https://polygent.market/sign'; // Or your own

// Create EOA signer
const eoaSigner = new Wallet(process.env.PRIVATE_KEY);

// Configure builder authentication
const builderConfig = new BuilderConfig({
  remoteBuilderConfig: {
    url: REMOTE_SIGNING_URL
  }
});

// Initialize relayer (handles Safe deployment + approvals)
const relayClient = new RelayClient(
  RELAYER_URL,
  POLYGON_CHAIN_ID,
  eoaSigner,
  builderConfig
);
```

### Step 4: Deploy Safe (One-Time, Gasless)

```typescript
// Check if Safe is already deployed
const isDeployed = await relayClient.getDeployed(safeAddress);

if (!isDeployed) {
  console.log('Deploying Safe (gasless via relayer)...');
  const deployResponse = await relayClient.deploy();
  const result = await deployResponse.wait();
  
  console.log('✅ Safe deployed at:', result.proxyAddress);
} else {
  console.log('✅ Safe already deployed');
}
```

### Step 5: Derive API Credentials

```typescript
import { ClobClient } from '@polymarket/clob-client';

const CLOB_URL = 'https://clob.polymarket.com';

// Create temporary CLOB client for credential derivation
const tempClient = new ClobClient(CLOB_URL, POLYGON_CHAIN_ID, eoaSigner);

// Derive or create L2 API credentials
let apiCreds;
try {
  apiCreds = await tempClient.deriveApiKey();
  console.log('✅ Derived existing API credentials');
} catch {
  apiCreds = await tempClient.createApiKey();
  console.log('✅ Created new API credentials');
}

// Save these for future trading sessions
const { key, secret, passphrase } = apiCreds;
```

### Step 6: Set Token Approvals (One-Time, Gasless)

```typescript
import { ApprovalType } from '@polymarket/builder-relayer-client';

const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

// Approve USDC.e for CTF (splits collateral)
console.log('Setting USDC.e approval...');
const usdc_approval = await relayClient.approve({
  tokenAddress: USDC_E,
  spender: CTF,
  amount: ethers.constants.MaxUint256.toString(),
});
await usdc_approval.wait();

// Approve CTF tokens for Exchange (trading)
console.log('Setting CTF approval...');
const ctf_approval = await relayClient.approve({
  tokenAddress: CTF,
  spender: EXCHANGE,
  approvalType: ApprovalType.SetApprovalForAll,
});
await ctf_approval.wait();

console.log('✅ All approvals set (gasless)');
```

### Step 7: Place Your First Trade

```typescript
// Now use Safe address with CLOB client
const clobClient = new ClobClient(
  CLOB_URL,
  POLYGON_CHAIN_ID,
  eoaSigner, // EOA signs on behalf of Safe
  {
    key: apiCreds.key,
    secret: apiCreds.secret,
    passphrase: apiCreds.passphrase
  }
);

// Create order (signs with EOA)
const order = await clobClient.createOrder({
  tokenID: 'market_token_id_here',
  price: 0.50,
  size: 10,
  side: 'BUY',
  feeRateBps: '0',
  expiration: 0 // GTC
});

// Submit to CLOB
const response = await clobClient.postOrder(order);
console.log('✅ Order placed:', response.orderID);
```

---

## Quick Start: EOA Path (Alternative)

### Step 1: Fund Wallet

```bash
# Send to your EOA:
# - $10+ USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
# - 0.1 POL ($0.03 for gas)
```

### Step 2: Set Approvals (Manual)

```bash
# Clone Polygent repo
git clone https://github.com/BAiSEDagent/polygent.git
cd polygent

# Run approval script (requires POL for gas)
PRIVATE_KEY=0xYourKey... node scripts/approve-exchange.js
```

### Step 3: Derive API Credentials

```typescript
import { ClobClient } from '@polymarket/clob-client';
import { Wallet, providers } from 'ethers';

const provider = new providers.JsonRpcProvider('https://polygon-rpc.com');
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

const tempClient = new ClobClient(
  'https://clob.polymarket.com',
  137,
  wallet
);

const apiCreds = await tempClient.deriveApiKey().catch(() => 
  tempClient.createApiKey()
);

console.log('API Key:', apiCreds.key);
console.log('Secret:', apiCreds.secret);
console.log('Passphrase:', apiCreds.passphrase);
```

### Step 4: Place Orders

```typescript
const clobClient = new ClobClient(
  'https://clob.polymarket.com',
  137,
  wallet,
  {
    key: apiCreds.key,
    secret: apiCreds.secret,
    passphrase: apiCreds.passphrase
  }
);

// Same order flow as Safe wallet example above
```

---

## Integration with Polygent Relay

### Option 1: Direct CLOB (No Builder Attribution)

Use the code examples above to trade directly with Polymarket CLOB.

**Pros:** Full control, no intermediary
**Cons:** No builder fee revenue, manual credential management

### Option 2: Polygent Relay (Builder Fee Attribution)

Send signed orders to Polygent's relay endpoint for automatic builder attribution.

```typescript
// Sign order locally (EOA or Safe)
const signedOrder = await clobClient.createOrder({...});

// POST to Polygent relay
const response = await fetch('https://polygent.market/api/v1/trade', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    order: signedOrder,
    agent_id: 'your_agent_name'
  })
});

const result = await response.json();
console.log('Order ID:', result.orderID);
```

**Pros:** Automatic builder fee attribution, unified analytics
**Cons:** Requires trust in Polygent relay (but order is signed, can't be modified)

---

## Reference Implementation

See Polymarket's official Safe wallet examples:
- [Wagmi + Safe](https://github.com/Polymarket/wagmi-safe-builder-example)
- [Privy + Safe](https://github.com/Polymarket/privy-safe-builder-example)
- [Magic + Safe](https://github.com/Polymarket/magic-safe-builder-example)
- [Turnkey + Safe](https://github.com/Polymarket/turnkey-safe-builder-example)

---

## Security Best Practices

### For EOA Wallets:
1. Never share your private key with anyone (including Polygent)
2. Use hardware wallet for production (Ledger, Trezor)
3. Monitor your wallet daily for unexpected transactions

### For Safe Wallets:
1. Use multi-sig if managing significant capital
2. Set transaction spending limits via Safe modules
3. Enable time-locks for large withdrawals

### For Both:
4. Verify all contract addresses before approving:
   - USDC.e: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
   - CTF: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`
   - Exchange: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
5. Start with small trades ($1-10) to validate the flow
6. Monitor positions via Polymarket UI: `polymarket.com/profile`

---

## Troubleshooting

### "Not enough balance / allowance" error on SELL orders
- **Cause:** CLOB balance sync delay after BUY fills
- **Fix:** Wait 5-30 minutes for settlement, then retry

### "Invalid signature" error
- **Cause:** Wrong chain ID or signer mismatch
- **Fix:** Verify `chainId=137` and EOA matches Safe owner

### Safe deployment fails
- **Cause:** Relayer connection issue
- **Fix:** Check builder credentials in `polymarket.com/settings`

### API credentials return 401
- **Cause:** Credentials expired or not derived correctly
- **Fix:** Re-derive using `ClobClient.deriveApiKey()`

---

## Support

- **Technical Issues:** Open issue on [GitHub](https://github.com/BAiSEDagent/polygent)
- **Integration Help:** DM @atescch on Telegram
- **Builder Program:** builder@polymarket.com

---

## Appendix: Contract Addresses

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Collateral token |
| CTF | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | Outcome token framework |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | Trading contract |
| Safe Factory | `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2` | Safe deployment |
| Relayer | `https://relayer.polymarket.com` | Gasless meta-txs |
| CLOB API | `https://clob.polymarket.com` | Order matching |

---

**Last Updated:** February 24, 2026 — Polygent v0.1.0
