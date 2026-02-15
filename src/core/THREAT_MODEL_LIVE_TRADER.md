# Threat Model: Live Trader Module

## What touches money
- Order placement via CLOB SDK (real USDC.e)
- Funder wallet balance consumed on fills

## Attack surfaces
1. **Runaway orders** — agent places orders faster than intended
   - Mitigation: per-agent mutex, global daily cap, per-order max $5
2. **Slippage** — market moves between signal and fill
   - Mitigation: limit orders only (no market orders), tick-size validation
3. **Credential exposure** — PK/API keys in logs
   - Mitigation: never log credentials, sanitize error messages
4. **Unbounded spending** — no total exposure limit
   - Mitigation: hard cap at TOTAL_CAPITAL, checked before every order
5. **Failed order leaves stale state** — order errors not handled
   - Mitigation: try/catch every order, log failures, don't update positions on failure

## Constraints
- Max $5 per order
- Max $50 total exposure
- Limit orders only (GTC)
- All errors fail closed (reject order, don't proceed)
