# Agent Onboarding Engine — Implementation Plan

## Scope
Three features to improve agent onboarding and platform usability:

1. **Market Discovery API** — `/api/markets/soonest` + `/api/markets/recommended`
2. **Auto-Redeem** — agent config toggle + automatic position settlement
3. **Sovereign Dashboard** — `/dashboard/:agentId` private cockpit view

## Requirements

### 1. Market Discovery API

**Files:**
- `src/api/markets.ts` (add new routes)
- `src/utils/market-scoring.ts` (new — agent-friendly scoring logic)
- `tests/market-scoring.test.ts` (new)

**Endpoints:**
- `GET /api/markets/soonest?limit=10&liquid=true&feeEnabled=false`
  - Returns markets ending soonest, filtered by liquidity/fee params
  - Include `timeToCloseSec`, `agentFriendly`, `estimatedSpreadBps`
- `GET /api/markets/recommended?agentId={id}&limit=5`
  - Scores markets by liquidity, spread, time-to-close, fee rate
  - Returns personalized recommendations

**Acceptance:**
- Both endpoints return valid market lists with extended metadata
- `agentFriendly` is `true` only for markets with spread <5% and liquidity >$1k
- Requests with invalid agentId return 404

### 2. Auto-Redeem

**Files:**
- `src/core/db.ts` (add `auto_redeem` column to agents table)
- `src/api/agents.ts` (add PATCH endpoint for config update)
- `src/services/auto-redeemer.ts` (new — settlement monitor + auto-redeem)
- `tests/auto-redeemer.test.ts` (new)

**Features:**
- Agent config includes `autoRedeem: boolean`
- Background service polls for settled markets every 5 minutes
- When market settles, automatically redeems positions for agents with `autoRedeem=true`
- Logs redemption success/failure

**Acceptance:**
- Agent can enable/disable auto-redeem via PATCH `/api/agents/{id}`
- Service detects settled positions and redeems successfully
- No double-redemption attempts

### 3. Sovereign Dashboard

**Files:**
- `frontend/src/Dashboard.tsx` (add route + AgentCockpit component)
- `frontend/src/components/AgentCockpit.tsx` (new)
- `src/api/routes.ts` (add `/dashboard/:agentId` route if needed for backend data)

**Features:**
- Private agent dashboard at `/dashboard/:agentId`
- Requires API key authentication (via query param or header)
- Shows: portfolio, open orders, recent trades, P&L, funding status
- Clean, minimal UI

**Acceptance:**
- Dashboard loads for valid agentId + apiKey
- Returns 401 for invalid/missing auth
- All data sections render correctly

## Commands

### Build
```bash
npm run build
```

### Test
```bash
npm run test
```

### Security
```bash
gitleaks detect --no-git --source .
npm audit --omit=dev
```

## Risks
- Market scoring logic may be too simplistic (iterative improvement needed)
- Auto-redeem could fail if CTF metadata is missing (graceful fallback required)
- Dashboard auth needs careful validation to prevent leakage

## Rollback
If any feature breaks production:
- Revert last commit: `git revert HEAD`
- Restart service: `systemctl restart polygent.service`
- Monitor logs: `journalctl -u polygent.service -f`

## Success Criteria
- All endpoints return valid responses
- Tests pass
- Security gates pass
- Ship Report includes execution evidence
