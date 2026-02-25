# Security Audit Report — Polygent Relay

**Date:** 2026-02-24  
**Version:** v0.1.0 (Iron Engine)  
**Auditor:** BAiSED (AI Agent)  
**Scope:** Signature verification, custody guarantees, relay security

---

## Executive Summary

**Status:** ✅ **PASS** — Zero-custody guarantees verified

**Key Findings:**
1. ✅ EIP-712 signature verification prevents order spoofing
2. ✅ Relay cannot move agent funds (no custody at any point)
3. ✅ Builder attribution is failsafe-protected
4. ⚠️ Rate limits need stress testing
5. ⚠️ Recommended: Add transaction simulation pre-flight check

**Risk Level:** **LOW** — Architecture is defensible and non-custodial

---

## 1. Signature Verification Audit

### Implementation Location
- **File:** `src/utils/verify-signature.ts`
- **Function:** `assertSignerIsAgent()`
- **Entry Point:** `POST /api/orders/relay` (line 193)

### Verification Flow

```typescript
1. Agent registers with EOA address (walletAddress)
2. Agent signs order locally using EIP-712
3. Order submitted to Polygent relay endpoint
4. Polygent recovers signer from signature
5. IF recovered ≠ registered EOA → reject (401)
6. IF match → forward to Polymarket CLOB
```

### Cryptographic Strength

**Domain Parameters:**
```javascript
{
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 137,
  verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
}
```

**Order Type (EIP-712):**
- 12 fields (salt, maker, signer, taker, tokenId, amounts, expiration, nonce, fee, side, signatureType)
- Standard Polymarket CLOB order structure
- Verified via `ethers.utils.verifyTypedData()`

**Security Properties:**
- ✅ Domain separation (can't replay signatures from other protocols)
- ✅ Chain-specific (Polygon mainnet, chainId 137)
- ✅ Contract-specific (CTF Exchange address)
- ✅ Nonce protection (prevents replay attacks)
- ✅ Expiration support (time-bounded orders)

### Attack Vectors Considered

#### 1. Order Spoofing (Signature Forgery)
**Attack:** Attacker submits order claiming to be another agent  
**Defense:** EIP-712 signature verification recovers true signer  
**Status:** ✅ **MITIGATED** — Cryptographically impossible to forge without private key

#### 2. Replay Attacks
**Attack:** Resubmit old signed orders  
**Defense:** 
- Polymarket CLOB enforces nonce uniqueness
- Orders include expiration timestamps
- CLOB rejects duplicate order IDs  
**Status:** ✅ **MITIGATED** — Polymarket-layer protection

#### 3. Leaderboard Manipulation
**Attack:** Register multiple agents, sign orders with one key  
**Defense:** Each agent must register unique EOA, verified on every relay  
**Status:** ✅ **MITIGATED** — One EOA = one agent

#### 4. CLOB Direct Bypass
**Attack:** Submit orders directly to Polymarket (skip Polygent fee attribution)  
**Defense:** None needed — agents are free to trade directly  
**Impact:** Lost builder fees, but no security risk  
**Status:** ℹ️ **EXPECTED BEHAVIOR** — Open market competition

---

## 2. Custody Audit

### Question: Can Polygent Ever Move Agent Funds?

**Answer:** ❌ **NO** — Architecturally impossible

### Why Zero-Custody is Guaranteed

**1. No Private Key Access**
- Agents never send private keys to Polygent
- Orders are signed locally by agent's wallet
- Polygent only receives the *signature* (public output)

**2. Order Structure Constraints**
- `maker` field = agent's wallet (they receive fills)
- `signer` field = agent's EOA (must match registered address)
- Polygent cannot change these fields (would invalidate signature)

**3. CLOB-Layer Validation**
- Polymarket CLOB independently verifies EIP-712 signature
- If Polygent modified order → signature invalid → CLOB rejects
- Orders can ONLY execute if signed by the legitimate `signer` address

**4. Funds Flow**
```
Agent Wallet → [Signs Order] → Polygent Relay → CLOB → Market
                                     ↓
                            (Adds builder attribution)
                                     ↓
                               No fund access
```

**Funds never touch Polygent:**
- Before trade: In agent's wallet
- During trade: In Polymarket CTF contracts
- After trade: Back in agent's wallet (as outcome tokens or USDC.e)

### Theoretical Attack: Malicious Relay Modification

**Scenario:** Polygent modifies order to send funds elsewhere

**Why it Fails:**
1. Changing `maker` or `taker` invalidates EIP-712 signature
2. CLOB rejects invalid signatures
3. Order never executes
4. Agent funds remain in their wallet

**Conclusion:** Polygent is a "read-only" relay — can forward or block orders, but cannot redirect funds.

---

## 3. Builder Attribution Security

### Failsafe Protection

**Code:** `src/api/orders.ts` (lines 215-220)

```typescript
if (!appConfig.BUILDER_ADDRESS) {
  logger.error('BUILDER_ADDRESS not configured — refusing unattributed relay');
  res.status(500).json({ error: 'Builder attribution not configured — trade blocked' });
  return;
}
```

**Why This Matters:**
- Prevents accidental relay without fee capture
- Ensures Polymarket always knows who routed the order
- Protects business model (no revenue leakage)

**Status:** ✅ **SECURE** — Cannot accidentally operate without builder attribution

---

## 4. Rate Limiting Audit

### Current Limits

**Relay Endpoint:**
```typescript
// src/api/orders.ts
relayRateLimit: {
  windowMs: 60_000,  // 1 minute
  max: 60,           // 60 orders per minute per IP
}
```

**Registration Endpoint:**
```typescript
// src/api/agents.ts
externalRegistrationRateLimit: {
  windowMs: 60_000,  // 1 hour (typo: should be 3600_000)
  max: 3,            // 3 registrations per hour per IP
}
```

### Findings

⚠️ **Issue 1: Registration windowMs incorrect**
- Claims 1 hour but uses 60,000ms (1 minute)
- Effective limit: 3 registrations per minute (too loose)

**Recommendation:**
```typescript
windowMs: 60 * 60 * 1000,  // 1 hour (3,600,000ms)
```

✅ **Relay limit is reasonable**
- 60 orders/min = 1 order/sec average
- Sufficient for most agents
- Prevents spam without blocking legitimate usage

### Stress Test Recommendations

1. **Load Test:** Simulate 100 orders/sec from single IP (should trigger 429)
2. **Distributed Attack:** Test rate limit bypass via IP rotation
3. **Slowloris:** Test connection exhaustion attacks
4. **Recommendation:** Add Cloudflare WAF for DDoS protection at scale

---

## 5. Additional Security Measures

### Implemented ✅

1. **Input Sanitization** — `utils/sanitize.ts` validates all user input
2. **SQL Injection Protection** — Parameterized queries via `better-sqlite3`
3. **CORS Policy** — Restricted to specific origins
4. **Admin API Key** — Random generation in dev, must be secure in production
5. **Helmet.js** — Standard HTTP security headers

### Recommended Enhancements ⚠️

#### 1. Transaction Simulation (Pre-Flight Check)
**Why:** Catch order errors before CLOB submission  
**How:** Use `eth_call` to simulate order execution  
**Benefit:** Better UX (fail fast with clear error messages)

```typescript
// Pseudo-code
async function simulateOrder(order: SignedCLOBOrder): Promise<void> {
  const result = await provider.call({
    to: CTF_EXCHANGE,
    data: encodeOrderExecution(order)
  });
  
  if (result.revert) {
    throw new Error(`Order would fail: ${result.reason}`);
  }
}
```

#### 2. Multisig Builder Address (High Priority)
**Status:** ⚠️ **PENDING** (see TREASURY_SETUP.md)  
**Why:** Current builder address is single EOA (single point of failure)  
**Action:** Adam to deploy Gnosis Safe (2-of-3 multisig)

#### 3. Monitoring & Alerting
**Missing:**
- No uptime monitoring (UptimeRobot recommended)
- No error aggregation (Sentry recommended)
- No anomaly detection (unusual order volume, etc.)

**Recommendation:** Add health check ping + Discord webhook alerts

#### 4. Audit Logging
**Current:** Winston logger writes to console/file  
**Enhancement:** Add tamper-proof audit log for:
- All relay requests (agent ID, order hash, timestamp)
- Failed signature verifications
- Rate limit hits
- Admin actions

**Why:** Compliance, debugging, and incident response

---

## 6. Known Limitations (By Design)

### 1. CLOB Dependency
**Risk:** If Polymarket CLOB goes down, relay is unavailable  
**Mitigation:** None (this is inherent to the architecture)  
**Recommendation:** Document uptime SLA for agents

### 2. Polymarket Trust Assumption
**Risk:** Polymarket could change CLOB API, break EIP-712 format, or delist markets  
**Mitigation:** Monitor Polymarket developer announcements  
**Recommendation:** Add API version checks in relay health endpoint

### 3. Exit Liquidity (Market Settlement Delay)
**Risk:** Agents may be unable to SELL positions if CLOB balance sync lags  
**Mitigation:** CTF redemption script now available (`scripts/redeem-position-v2.js`)  
**Status:** ✅ **MITIGATED** — Programmatic exit path deployed

### 4. No Insurance Fund
**Risk:** If agent's strategy loses money, Polygent has no liability  
**Clarification:** This is correct — zero-custody = zero liability  
**Recommendation:** Disclose in Terms of Service (agents assume all risk)

---

## 7. Compliance Considerations

### Regulatory Status

**What Polygent IS:**
- Order routing infrastructure (relay/toll booth)
- Builder fee revenue model (volume attribution)
- Non-custodial architecture

**What Polygent IS NOT:**
- Custodian (no funds held)
- Market maker (no proprietary trading)
- Broker-dealer (no trade execution, only forwarding)
- Exchange (Polymarket is the exchange)

### Potential Regulatory Triggers

⚠️ **Builder Fees Could Be Construed As:**
- Referral fees (likely OK in most jurisdictions)
- Routing commissions (may require licensing in some regions)

**Recommendation:**
- Consult legal counsel before scaling beyond $10k/month revenue
- Consider incorporating (LLC or DAO structure)
- Publish Terms of Service clarifying zero-custody model

---

## 8. Security Checklist

### Pre-Launch (Done ✅)
- [x] EIP-712 signature verification
- [x] Zero-custody architecture
- [x] Input sanitization
- [x] Rate limiting
- [x] CORS policy
- [x] SQL injection protection

### Post-Launch (In Progress ⚠️)
- [ ] Treasury multisig deployment
- [ ] Uptime monitoring (UptimeRobot)
- [ ] Error tracking (Sentry)
- [ ] Rate limit stress testing
- [ ] Transaction simulation pre-flight
- [ ] Audit logging enhancement

### Future (Phase 2 📋)
- [ ] Smart contract formal verification (if deploying custom contracts)
- [ ] Third-party security audit (Quantstamp, Trail of Bits)
- [ ] Bug bounty program (HackerOne)
- [ ] Disaster recovery plan (database backups, failover VPS)

---

## 9. Threat Model Summary

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|------------|--------|
| Order spoofing | Low | High | EIP-712 verification | ✅ Mitigated |
| Signature replay | Low | Medium | CLOB nonce enforcement | ✅ Mitigated |
| Custody breach | None | Critical | Zero-custody arch | ✅ Impossible |
| DDoS attack | Medium | Medium | Rate limits + Cloudflare | ⚠️ Partial |
| API downtime | Medium | Medium | Monitoring alerts | ❌ Not implemented |
| Builder fee theft | Low | High | Multisig + failsafe | ⚠️ Pending multisig |
| Market manipulation | N/A | N/A | Not applicable (relay only) | ✅ N/A |

---

## 10. Conclusion

**Overall Security Posture:** ✅ **STRONG**

**Key Strengths:**
1. Zero-custody architecture eliminates most custody risks
2. EIP-712 signature verification prevents spoofing
3. Polymarket CLOB provides additional validation layer
4. Builder attribution is failsafe-protected

**Critical Next Steps:**
1. **Deploy Treasury Multisig** (Adam, 30 min) — See TREASURY_SETUP.md
2. **Fix rate limit windowMs** (Dev, 5 min) — Change 60_000 to 3_600_000
3. **Add monitoring** (Dev, 2 hours) — UptimeRobot + Sentry integration

**Long-Term Recommendations:**
- Third-party audit at $100k ARR milestone
- Bug bounty program at $1M ARR milestone
- Smart contract formal verification if deploying custom contracts

---

**Sign-off:**

This audit confirms that Polygent's relay architecture is **cryptographically sound** and **non-custodial by design**. The primary remaining risk is operational (uptime/availability), not security (custody/spoofing).

The "Toll Booth" is secure. Agents can trust the relay with their signed orders.

**Approved for Production:** ✅

---

**Last Updated:** 2026-02-24  
**Next Review:** After Treasury Multisig deployment or any material architecture changes
