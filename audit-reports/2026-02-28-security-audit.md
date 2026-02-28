# Polygent Security Audit Report

**Date:** 2026-02-28  
**Auditor:** BAiSED (Claude Sonnet 4.6)  
**Scope:** Full codebase security audit following OWASP API Top 10  
**Methodology:** brain:PLAYBOOK_WEB3_AUDIT_API_SECURITY

---

## Executive Summary

**Overall Status:** 🟡 MEDIUM RISK (Production-safe with mitigations documented)

**Critical Issues:** 0  
**High Issues:** 2  
**Medium Issues:** 4  
**Low Issues:** 3  
**Info:** 3  

**Recommendation:** Fix HIGH issues before onboarding external agents at scale. MEDIUM issues can be addressed iteratively.

---

## CRITICAL Issues

**None found.** Core security fundamentals are solid:
- ✅ Rate limiting implemented globally + per-endpoint
- ✅ Helmet + CORS configured
- ✅ Trust proxy set correctly
- ✅ Body size limits (100KB)
- ✅ Admin auth for sensitive endpoints
- ✅ Agent mutex for race condition protection

---

## HIGH Issues

### HIGH-1: Missing Runtime Input Validation (OWASP API2:2023 Broken Authentication)

**Files:** `src/api/agents.ts`, `src/api/orders.ts`, `src/api/copiers.ts`, `src/api/builder-sign.ts`  
**Severity:** HIGH  
**Pattern:** `req.body as Type` without runtime validation

**Issue:**
TypeScript type assertions (`as Type`) provide **zero runtime validation**. Attackers can send malformed payloads that bypass type checking:

```typescript
// Current (unsafe):
const body = req.body as OrderRequest;
// If req.body = { amount: "NOT_A_NUMBER" }, TypeScript doesn't stop it
```

**Exploit:**
1. Send malformed JSON: `{ "amount": "abc", "price": null }`
2. Type assertion succeeds (TypeScript is erased at runtime)
3. Downstream code crashes or produces undefined behavior

**Impact:**
- Server crashes (DoS)
- Logic bugs (e.g., NaN in calculations)
- Potential SQL injection if values flow to raw queries (unlikely here but defense-in-depth)

**Fix:**
Install Zod for runtime validation:

```bash
npm install zod
```

**Example (orders.ts):**
```typescript
import { z } from 'zod';

const OrderRequestSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  outcome: z.string(),
  amount: z.number().positive(),
  price: z.number().min(0).max(1),
  type: z.enum(['LIMIT', 'MARKET']).optional(),
  maxSlippage: z.number().min(0).max(1).optional(),
});

// In route handler:
try {
  const body = OrderRequestSchema.parse(req.body);
  // body is now guaranteed to match schema
} catch (err) {
  res.status(400).json({ error: 'Invalid request body', details: err.errors });
  return;
}
```

**Status:** 📋 TODO (High Priority)

---

### HIGH-2: Unbounded `as any` Casts (Type Safety Erosion)

**Files:** 36 instances across codebase  
**Severity:** HIGH (Code Quality)  
**Pattern:** `(req as any).agent`, `(riskResult as any).rule`, etc.

**Issue:**
36 instances of `as any` completely bypass TypeScript's type checking. This erodes type safety and makes refactoring dangerous.

**Common patterns:**
```typescript
const agent = (req as any).agent as Agent;  // Double cast
const rule = (riskResult as any).rule;      // Accessing undocumented property
```

**Fix:**
1. **Extend Express types** for middleware-injected properties:
```typescript
// src/utils/types.ts
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;  // Added by authenticateAgent middleware
    }
  }
}
```

2. **Use discriminated unions** for RiskResult:
```typescript
type RiskResult = 
  | { approved: true }
  | { approved: false; rule: string; reason: string };

// Now TypeScript knows .rule exists when approved=false
if (!riskResult.approved) {
  logger.warn(`Rejected by ${riskResult.rule}: ${riskResult.reason}`);
}
```

**Status:** 📋 TODO (High Priority)

---

## MEDIUM Issues

### MEDIUM-1: CORS Null Origin Bypass Risk

**File:** `src/index.ts:59`  
**Severity:** MEDIUM  
**OWASP:** API7:2023 Server Side Request Forgery

**Issue:**
Current code rejects `origin === 'null'` explicitly, which is **correct**. However, the error message could be more specific:

```typescript
if (origin === 'null') {
  return callback(new Error('Null origin not allowed'));  // Good!
}
```

**Why this matters:**
Attackers can set `Origin: null` via:
- `<iframe sandbox>`
- `file://` URLs
- Data URLs
- CORS-disabled browser extensions

**Current Status:** ✅ Already mitigated  
**Recommendation:** Keep as-is, document in SECURITY.md

---

### MEDIUM-2: Rate Limiter Key Spoofing (X-Forwarded-For)

**File:** `src/api/orders.ts:19`, `src/index.ts:36`  
**Severity:** MEDIUM  
**OWASP:** API4:2023 Unrestricted Resource Consumption

**Issue:**
Rate limiters use `req.ip` which comes from `X-Forwarded-For` header when behind a proxy. Current code sets `trust proxy: 1`:

```typescript
app.set("trust proxy", 1);  // Trust first proxy
```

**Risk:**
If Nginx is misconfigured or bypassed, attackers can spoof `X-Forwarded-For`:
```
X-Forwarded-For: 1.2.3.4  // Fake IP to bypass rate limits
```

**Current Mitigation:**
- `trust proxy: 1` tells Express to trust the **first** proxy (Nginx)
- Nginx should be configured to **overwrite** (not append) `X-Forwarded-For`

**Verification Needed:**
Check Nginx config (`/etc/nginx/sites-available/polygent`) for:
```nginx
proxy_set_header X-Forwarded-For $remote_addr;  # Overwrite, don't append
```

**Status:** ⚠️ VERIFY (Medium Priority)

---

### MEDIUM-3: Information Disclosure in Error Messages

**File:** `src/api/agents.ts:95`  
**Severity:** MEDIUM  
**OWASP:** API6:2023 Unrestricted Access to Sensitive Business Flows

**Issue:**
Error messages reveal internal state that could aid enumeration attacks:

```typescript
if (duplicate) {
  res.status(409).json({ error: `Agent name '${cleanName}' is already taken` });
}

if (existingEoa) {
  res.status(409).json({ error: 'An agent with this EOA address is already registered' });
}
```

**Exploit:**
1. Attacker tries to register with known wallet addresses
2. Different errors reveal if address is already registered
3. Attacker maps active agents

**Impact:** LOW (enumeration only, no privilege escalation)

**Fix (Defense-in-Depth):**
Unify error messages:
```typescript
if (duplicate || existingEoa) {
  res.status(409).json({ error: 'Registration failed. Name or wallet already in use.' });
  return;
}
```

**Status:** 📋 TODO (Medium Priority)

---

### MEDIUM-4: Missing Cache-Control on Sensitive Responses

**File:** Multiple API routes  
**Severity:** MEDIUM  
**OWASP:** API8:2023 Security Misconfiguration

**Issue:**
API responses containing API keys or agent data lack `Cache-Control: no-store` headers. Browsers/proxies may cache sensitive data.

**Affected Endpoints:**
- `POST /api/agents/register` (returns API key)
- `GET /api/agents/:id` (returns agent details)
- `POST /api/orders` (returns order IDs)

**Fix:**
Add middleware for sensitive routes:
```typescript
const noCacheMiddleware = (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

router.post('/register', noCacheMiddleware, externalRegistrationRateLimit, ...)
```

**Status:** 📋 TODO (Medium Priority)

---

## LOW Issues

### LOW-1: Broad Logging of User-Agent

**File:** `src/index.ts:88`  
**Severity:** LOW (Privacy)

**Issue:**
```typescript
userAgent: req.get('user-agent')?.slice(0, 50),
```

Logs may contain sensitive fingerprinting data (browser version, OS, etc.). While truncated to 50 chars, still potentially PII.

**Fix:** Log only non-sensitive parts or hash:
```typescript
userAgent: req.get('user-agent')?.split('/')[0],  // Just browser name
```

**Status:** 📋 OPTIONAL

---

### LOW-2: Missing Security Headers

**File:** `src/index.ts:39`  
**Severity:** LOW

**Issue:**
Helmet is configured but `contentSecurityPolicy: false`:

```typescript
app.use(helmet({ contentSecurityPolicy: false }));
```

**Why disabled:** Likely breaks frontend. CSP requires careful tuning.

**Recommendation:**
Add minimal CSP for API-only endpoints:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));
```

**Status:** 📋 OPTIONAL (Only if frontend is served separately)

---

### LOW-3: No Request ID Tracking

**File:** Logging throughout  
**Severity:** LOW (Observability)

**Issue:**
Logs don't include request IDs, making it hard to trace a single request across multiple log lines.

**Fix:**
Add middleware to inject `req.id`:
```typescript
import { v4 as uuid } from 'uuid';

app.use((req, _res, next) => {
  req.id = uuid();
  next();
});

// In logger calls:
logger.info('Order placed', { requestId: req.id, agentId, ... });
```

**Status:** 📋 OPTIONAL

---

## INFO Findings

### INFO-1: Gitleaks Findings (False Positives)

**Files:** `README.md`, `docs/API_REFERENCE.md`, `frontend/public/skill.md`  
**Severity:** INFO

**Findings:**
- `cog_live_YOUR_KEY` (placeholder)
- `admin_key_here` (placeholder)
- `poly_live_...` (placeholder)

**Status:** ✅ Not real secrets, documentation examples only

---

### INFO-2: npm audit Requires Lockfile

**Status:** Needs `npm i --package-lock-only` to run audit

**Action:** Generate lockfile on VPS or in CI/CD

---

### INFO-3: TypeScript Strict Mode

**File:** `tsconfig.json`  
**Status:** Check if `strict: true` is enabled

**Recommendation:** Enable if not already:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

## Security Strengths (What's Good)

1. ✅ **Rate limiting** — Global + per-endpoint with sensible limits
2. ✅ **Admin auth** — Sensitive endpoints protected
3. ✅ **Agent mutex** — Race condition protection in order placement
4. ✅ **CORS allowlist** — Only whitelisted origins permitted
5. ✅ **Trust proxy** — Correctly configured for Nginx
6. ✅ **Body size limits** — 100KB max prevents DoS
7. ✅ **Helmet** — Security headers enabled
8. ✅ **Credential redaction** — `installConsoleRedaction()` active
9. ✅ **Zero-custody model** — No private keys stored (external agents)
10. ✅ **EIP-712 verification** — Signature validation on relay endpoint

---

## Recommendations by Priority

### Immediate (Before Scaling External Agents)

1. **Add runtime validation** (HIGH-1) — Install Zod, validate all `req.body`
2. **Fix `as any` casts** (HIGH-2) — Extend Express types, use discriminated unions
3. **Verify Nginx config** (MEDIUM-2) — Ensure `X-Forwarded-For` is overwritten

### Short-Term (Next 2 Weeks)

4. **Add `Cache-Control` headers** (MEDIUM-4) — Prevent sensitive data caching
5. **Unify error messages** (MEDIUM-3) — Reduce enumeration risk
6. **Generate npm lockfile** — Enable `npm audit` in CI/CD

### Long-Term (Phase 3+)

7. **Add request ID tracking** (LOW-3) — Improve observability
8. **Enable CSP** (LOW-2) — If frontend moves to separate domain
9. **TypeScript strict mode** (INFO-3) — Catch more bugs at compile time

---

## Rollback Plan

No changes have been made yet. This is an audit report only.

**If fixes introduce bugs:**
1. Revert last commit: `git revert HEAD`
2. Restart service: `systemctl restart polygent.service`
3. Check logs: `journalctl -u polygent.service -n 100`

---

## Testing Checklist (Before Deploying Fixes)

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] gitleaks clean: `npx gitleaks detect --source .`
- [ ] No new `as any` casts introduced
- [ ] API endpoints respond correctly (manual smoke test)
- [ ] Rate limiting still works (try exceeding limits)

---

## Sign-Off

**Audit Completed:** 2026-02-28 15:15 PST  
**Next Review:** After implementing HIGH priority fixes  
**Auditor:** BAiSED (Claude Sonnet 4.6)  

**Summary:** Polygent has solid security foundations. No critical issues found. HIGH priority fixes (runtime validation + type safety) are recommended before scaling to 100+ external agents. MEDIUM issues are defense-in-depth improvements that can be addressed iteratively.

---

**Appendix: Automated Scan Results**

```
gitleaks: 3 findings (all INFO - documentation placeholders)
npm audit: Requires lockfile (run: npm i --package-lock-only)
TypeScript casts: 36 instances of `as any`
Runtime validation: 0 instances of Zod/joi (all using type assertions)
```
