# Programmatic Exit: Current Status

## Issue
CLOB v5 SDK rejects SELL orders with "not enough balance / allowance" despite:
- ✅ Onchain balance confirmed (3.03 shares)
- ✅ All approvals set correctly
- ✅ 45+ minute settlement window passed

## Root Cause
The CLOB's internal balance ledger hasn't synced with onchain state. This appears to be a known limitation when trading via direct SDK (not through Polymarket UI).

## Exit Options

### Option 1: Polymarket UI (Immediate)
1. Go to https://polymarket.com/profile
2. Connect wallet `0x55ea5a71f37f6E352b42Ec3da09F2172ae49d922`
3. View "Positions" tab
4. Click "Sell" on Trump Gold Cards position
5. Order will execute immediately (UI bypasses CLOB sync issue)

### Option 2: Wait for CLOB Sync (Hours to Days)
The CLOB may eventually sync the balance. Retry SELL orders periodically:
```bash
node scripts/limit-sell.js
```

### Option 3: Direct CTF Redemption (Requires Market Params)
To programmatically redeem via `CTF.redeemPositions()`, need:
- `conditionId` (from market creation)
- `parentCollectionId` (collection hash)
- `indexSets` (outcome indices)

These can be queried from Polymarket Gamma API:
```bash
curl "https://gamma-api.polymarket.com/markets?condition_id=CONDITION_ID"
```

Then call:
```solidity
CTF.redeemPositions(
  USDC_E,           // collateralToken
  parentCollectionId,
  conditionId,
  [indexSet]        // e.g., [1] for YES outcome
)
```

### Option 4: Transfer to Another Wallet
The outcome tokens can be transferred to a wallet that already has CLOB sync:
```javascript
// ERC-1155 transfer
ctf.safeTransferFrom(
  from,
  to,
  TOKEN_ID,
  amount,
  "0x"
);
```

## Recommendation for Autonomous Agents

For production autonomous trading:
1. **Use Safe wallets with RelayerClient** (per ONBOARDING_V2.md)
   - May have better CLOB integration
   - Gasless operations
2. **Implement market metadata caching** to enable direct CTF redemption
3. **Add fallback logic**: If SELL fails after N attempts, trigger CTF redemption
4. **Contact Polymarket Builder Support** for CLOB sync timing guarantees

## Long-Term Fix

Add to Polygent's core:
```typescript
// src/core/exit-manager.ts
async function closePosition(tokenId: string, amount: string) {
  // Try CLOB SELL first
  try {
    return await placeSellOrder(tokenId, amount);
  } catch (err) {
    if (err.message.includes('not enough balance')) {
      // Fallback to CTF redemption
      const marketParams = await getMarketParams(tokenId);
      return await redeemViaCtf(marketParams, amount);
    }
    throw err;
  }
}
```

This requires:
1. Market metadata caching (conditionId, etc.)
2. CTF ABI integration
3. Testing across different market types (binary, scalar, categorical)

---

**Current Position Status:**
- 3.03 shares in wallet `0x55ea5a71f37f6E352b42Ec3da09F2172ae49d922`
- Value: ~$3 USDC.e (at current price)
- Onchain confirmed, CLOB not synced
- Manual exit via UI available immediately
