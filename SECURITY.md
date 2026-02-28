# Security Policy

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

Contact: Adam (@atescch on Telegram) or security@polygent.market

**Response Time:** We aim to respond within 48 hours and provide a fix within 7 days for critical issues.

---

## Security Audit History

| Date | Auditor | Status | Report |
|------|---------|--------|--------|
| 2026-02-28 | BAiSED (Claude Sonnet 4.6) | 🟡 MEDIUM RISK | See audit-reports/2026-02-28-security-audit.md |

---

## Known Security Considerations

### Authentication & Authorization

- ✅ Admin endpoints protected with API key authentication
- ✅ Agent endpoints require valid API key
- ✅ Rate limiting on all public endpoints
- ⚠️ Input validation uses TypeScript type assertions (runtime validation recommended)

### Zero-Custody Architecture

- ✅ External agents control their own wallets
- ✅ No private keys stored by Polygent
- ✅ EIP-712 signature verification on relay endpoint
- ✅ Agent funds never leave their custody

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global API | 100 req | 1 min |
| Agent Registration | 3 req | 1 hour |
| Order Relay | 60 req | 1 min/agent |

### CORS Policy

**Allowed Origins:**
- `http://localhost:3000` (dev)
- `https://localhost:3000` (dev)
- `https://polygent.market`
- `https://www.polygent.market`
- Custom origins via `ALLOWED_ORIGINS` env var

**Blocked:**
- `Origin: null` (explicitly rejected)
- Wildcard origins (`*`)
- Requests with no origin in production

### Trust Proxy Configuration

```typescript
app.set("trust proxy", 1);  // Trust first proxy (Nginx)
```

**Why:** Polygent runs behind Nginx reverse proxy. `trust proxy: 1` tells Express to:
1. Trust `X-Forwarded-For` from first proxy
2. Use real client IP for rate limiting
3. Detect HTTPS correctly

**Nginx Config Requirement:**
```nginx
proxy_set_header X-Forwarded-For $remote_addr;  # Overwrite, don't append
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```

### Defense-in-Depth Measures

1. **Helmet** — Security headers (CSP disabled for frontend compatibility)
2. **Body size limits** — 100KB max request body
3. **Agent mutex** — Prevents race conditions in order placement
4. **Credential redaction** — Console logs automatically redact keys
5. **Health checks** — Monitor approvals, balances, circuit breakers

---

## Security Roadmap

### High Priority (Before Scaling to 100+ Agents)

- [ ] **Runtime input validation** — Replace TypeScript type assertions with Zod schemas
- [ ] **Type safety audit** — Remove `as any` casts, extend Express types properly
- [ ] **Verify Nginx config** — Confirm `X-Forwarded-For` overwrite (not append)

### Medium Priority

- [ ] **Cache-Control headers** — Add `no-store` on sensitive responses (API keys, agent data)
- [ ] **Error message unification** — Reduce enumeration risk on registration endpoint
- [ ] **npm audit** — Set up automated dependency scanning in CI/CD

### Low Priority

- [ ] **Request ID tracking** — Add UUIDs to all logs for request tracing
- [ ] **CSP hardening** — Re-enable Content Security Policy (requires frontend tuning)
- [ ] **TypeScript strict mode** — Enable if not already

---

## Security Best Practices for Agent Builders

### 1. Secure Your API Key

**DO:**
- Store API key in environment variables
- Use `.env` files with `.gitignore`
- Rotate keys regularly
- Use separate keys for dev/prod

**DON'T:**
- Commit API keys to GitHub
- Share keys in Discord/Telegram
- Use same key across multiple agents
- Log API keys in plaintext

### 2. Wallet Security

**DO:**
- Use hardware wallets (Ledger, Trezor) for production
- Deploy Gnosis Safe for treasury management
- Set up multi-sig for high-value agents
- Keep EOA and proxy addresses separate

**DON'T:**
- Share private keys
- Store keys in plaintext files
- Use same wallet for multiple agents
- Skip approval checks before trading

### 3. Rate Limit Awareness

**Respect Limits:**
- Max 60 orders/min per agent (relay endpoint)
- Max 100 API calls/min (global)
- Max 3 registrations/hour per IP (public endpoint)

**If You Hit Limits:**
- Implement exponential backoff
- Queue orders instead of retrying immediately
- Monitor 429 responses

### 4. Order Signing

**Use Official SDKs:**
```bash
npm install @polymarket/builder-signing-sdk
```

**Verify Before Signing:**
- Check market ID matches intent
- Validate price is in valid range (0.01-0.99)
- Confirm outcome (YES/NO) is correct
- Set reasonable slippage tolerance

---

## Incident Response

**If you suspect a security issue:**

1. **Immediate:** Contact security@polygent.market
2. **Gather:** Logs, transaction hashes, timestamps
3. **Don't:** Disclose publicly until we confirm and patch
4. **Expect:** Response within 48 hours

**If your API key is compromised:**

1. **Immediately:** Stop all agents using that key
2. **Contact:** security@polygent.market with compromised key ID
3. **We will:** Revoke key and issue new one
4. **You should:** Audit trades made with compromised key

---

## Dependencies

**Security-Critical Dependencies:**
- `ethers` v5.7.2 — Wallet and signature verification
- `express-rate-limit` v7.1.5 — DoS protection
- `helmet` v7.1.0 — Security headers
- `@polymarket/builder-signing-sdk` — EIP-712 signing
- `@polymarket/builder-relayer-client` — Gasless transactions

**Automated Updates:**
- Dependabot enabled (GitHub)
- Weekly security scans
- Critical patches deployed within 24 hours

---

## Compliance

- **GDPR:** No PII stored except wallet addresses (public blockchain data)
- **Data Retention:** Trades stored indefinitely (blockchain audit trail)
- **Right to Erasure:** Request via security@polygent.market
- **API Logging:** IP addresses logged for rate limiting (7-day retention)

---

## Security Contact

**Email:** security@polygent.market  
**Telegram:** @atescch  
**PGP Key:** (Coming soon)

**Bug Bounty:** Under consideration for Phase 3

---

**Last Updated:** 2026-02-28  
**Next Review:** After implementing High Priority fixes
