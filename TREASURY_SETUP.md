# Treasury Multisig Setup Guide

**Purpose:** Separate protocol builder fee revenue from operational wallet for security and accounting.

---

## Why a Multisig?

**Current Setup (Insecure):**
- Builder fees accrue to a single EOA wallet
- If private key is compromised, all accumulated revenue is lost
- No separation between operational funds and protocol revenue

**Multisig Setup (Secure):**
- Builder fees accrue to a Gnosis Safe (2-of-3 or 3-of-5 multisig)
- Requires multiple signatures to withdraw revenue
- Separates operational expenses from protocol treasury
- Enables transparent accounting for partnerships/investors

---

## Setup Instructions

### Step 1: Create Gnosis Safe on Polygon

1. Go to https://app.safe.global
2. Connect your EOA wallet (current BUILDER_ADDRESS)
3. Click "Create new Safe"
4. Select **Polygon** network
5. Add signers:
   - **Owner 1:** Your primary EOA (current BUILDER_ADDRESS)
   - **Owner 2:** Adam's wallet (backup/co-founder)
   - **Owner 3:** Cold storage wallet (optional, recommended for >$10k revenue)
6. Set threshold: **2-of-3** (requires 2 signatures to execute)
7. Deploy Safe (costs ~$0.50 in POL)
8. **Save the Safe address** (0x...)

### Step 2: Update Polymarket Builder Profile

1. Go to https://polymarket.com/settings?tab=builder
2. Update **Builder Payout Address** to your new Safe address
3. Confirm the change
4. **Note:** Polymarket pays builder fees weekly/monthly to this address

### Step 3: Update Polygent Configuration

Edit `.env` on the VPS:

```bash
# Old (EOA wallet)
BUILDER_ADDRESS=0x55ea5a71f37f6E352b42Ec3da09F2172ae49d922

# New (Gnosis Safe multisig)
BUILDER_ADDRESS=0xYourNewSafeAddress...
```

Restart the service:
```bash
systemctl restart polygent
```

### Step 4: Test the Setup

1. Wait for next builder fee payout from Polymarket
2. Verify funds arrive at Safe address (not EOA)
3. Practice creating a transaction in Safe UI
4. Get co-signer to approve a test withdrawal

---

## Safe Address: `[TO BE FILLED IN AFTER DEPLOYMENT]`

**Safe Address:** `0x_____________________` (Polygon)

**Owners:**
1. `0x55ea5a71f37f6E352b42Ec3da09F2172ae49d922` (Primary)
2. `0x_____________________` (Adam)
3. `0x_____________________` (Cold storage, optional)

**Threshold:** 2-of-3 signatures required

**Safe App URL:** https://app.safe.global/home?safe=matic:0x_____________________

---

## Withdrawal Process (When Revenue Accumulates)

### Monthly Revenue Withdrawal:

1. Log into Safe at https://app.safe.global
2. Click "New Transaction"
3. Select "Send funds"
4. Enter:
   - **Recipient:** Your operational wallet or exchange deposit address
   - **Amount:** Portion of revenue to withdraw (e.g., 50% for operations, 50% to savings)
   - **Token:** USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
5. Confirm and sign with your wallet
6. Share transaction link with Adam (or 2nd signer)
7. They approve the transaction
8. Funds transfer after 2nd signature

### Emergency Access:

If you lose access to your primary wallet:
- Adam can initiate recovery using his signer
- Cold storage wallet can break ties
- Safe UI has built-in recovery flow

---

## Credentials & Access

**Safe Login:**
- **Method:** WalletConnect (use your EOA or hardware wallet)
- **URL:** https://app.safe.global
- **Network:** Polygon
- **Safe Address:** (see above)

**Backup Access (Adam):**
- Use your wallet to connect to Safe
- You're Owner #2 — can co-sign any transaction
- Can also initiate withdrawals yourself

**Private Key Storage:**
- DO NOT store Safe owner keys in plaintext
- Use hardware wallet (Ledger/Trezor) for primary signer
- Keep recovery phrase in secure physical location (safety deposit box)

---

## Current Builder Fee Status

**Platform Revenue to Date:**
- Total accrued: $0.0015 USDC (3 test trades)
- Live tracking: https://polygent.market (Builder Fees ticker)
- Expected first real payout: ~$0-10/week initially, scales with volume

**Polymarket Payout Schedule:**
- Builder fees paid weekly (for high-volume builders)
- Or monthly (for smaller volumes)
- Check Polymarket builder portal for exact schedule

---

## Security Best Practices

1. **Never share Safe owner private keys** — they control the treasury
2. **Use hardware wallets** for Safe signers when revenue >$1,000
3. **Enable transaction notifications** in Safe settings
4. **Review all transactions carefully** before signing
5. **Keep 1 signer offline** (cold storage) for recovery scenarios
6. **Document all withdrawals** for tax/accounting purposes

---

## Questions?

- **Safe docs:** https://docs.safe.global
- **Polygon block explorer:** https://polygonscan.com
- **Polymarket builder support:** builder@polymarket.com

---

**Next Steps:**
1. [ ] Create Gnosis Safe on Polygon
2. [ ] Add Adam as co-signer
3. [ ] Update Polymarket payout address
4. [ ] Update `.env` BUILDER_ADDRESS
5. [ ] Test transaction in Safe UI
6. [ ] Document Safe address in this file
7. [ ] Move this file to secure location (Desktop or password manager)

**Status:** ⚠️ PENDING — Adam to execute setup
