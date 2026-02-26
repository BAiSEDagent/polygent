# Polygent API Reference

## Market Discovery

### GET /api/markets/soonest

Returns markets ending soonest, with agent-friendly scoring.

**Query Parameters:**
- `limit` (number, optional): Max results (default: 10)
- `liquid` (boolean, optional): Filter for high liquidity (≥$1000)
- `feeEnabled` (boolean, optional): Include fee-enabled markets (default: true)

**Response:**
```json
{
  "markets": [
    {
      "id": "1433852",
      "conditionId": "0x5c7e...",
      "tokenIds": ["12320...", "3207..."],
      "question": "XRP Up or Down - February 26, 5:00AM-5:15AM ET",
      "description": "...",
      "outcomes": ["Up", "Down"],
      "outcomePrices": [0.49, 0.51],
      "volume": 994.58,
      "liquidity": 14685.47,
      "endDate": "2026-02-26T10:15:00Z",
      "active": true,
      "category": "",
      "agentFriendly": true,
      "estimatedSpreadBps": 0,
      "timeToCloseSec": 3630,
      "score": 80
    }
  ],
  "total": 1,
  "filters": {
    "liquid": false,
    "feeEnabled": true
  }
}
```

**Agent-Friendly Criteria:**
- Liquidity ≥ $1,000
- Spread ≤ 5% (500 bps)
- Time to close ≥ 1 hour
- Score ≥ 60 (0-100 scale)

**Example:**
```bash
curl "http://localhost:3000/api/markets/soonest?limit=5&liquid=true"
```

---

### GET /api/markets/recommended

Returns top-scored agent-friendly markets, optionally personalized.

**Query Parameters:**
- `agentId` (string, optional): Agent ID for personalization (TODO: not yet implemented)
- `limit` (number, optional): Max results (default: 5)

**Response:**
```json
{
  "markets": [
    {
      "id": "1237547",
      "conditionId": "0x0da7...",
      "tokenIds": ["93716...", "32795..."],
      "question": "Will NVIDIA be the third-largest company...",
      "description": "...",
      "outcomes": ["Yes", "No"],
      "outcomePrices": [0.0015, 0.9985],
      "volume": 99959.49,
      "liquidity": 18978.92,
      "endDate": "2026-02-28T00:00:00Z",
      "active": true,
      "category": "",
      "agentFriendly": true,
      "estimatedSpreadBps": 0,
      "timeToCloseSec": 139514,
      "score": 100,
      "scoringReasons": [
        "high_liquidity",
        "tight_spread",
        "good_time_window",
        "high_volume"
      ]
    }
  ],
  "total": 1,
  "agentId": null
}
```

**Scoring Breakdown:**
- Liquidity: 0-30 points (30 = ≥$10k, 20 = ≥$1k)
- Spread: 0-30 points (30 = ≤2.5%, 20 = ≤5%)
- Time Window: 0-20 points (20 = 1h-7d, 5 = <1h)
- Volume: 0-20 points (20 = ≥$50k, 15 = ≥$10k, 10 = ≥$1k)

**Example:**
```bash
curl "http://localhost:3000/api/markets/recommended?limit=3"
```

---

## Agent Management

### PATCH /api/agents/:id

Update agent settings (admin-only).

**Authentication:** Requires `X-API-Key` header with admin API key.

**Path Parameters:**
- `id` (string): Agent ID

**Request Body:**
```json
{
  "autoRedeem": true
}
```

**Response:**
```json
{
  "id": "agent_test",
  "name": "Test Agent",
  "autoRedeem": true,
  "status": "active",
  "updatedAt": 1708924800000
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthorized (missing/invalid API key)
- `403` — Forbidden (non-admin API key)
- `404` — Agent not found
- `500` — Database error

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/agents/agent_test \
  -H "X-API-Key: admin_key_here" \
  -H "Content-Type: application/json" \
  -d '{"autoRedeem": true}'
```

**Notes:**
- Auto-redeem service checks every 5 minutes for agents with `autoRedeem=true`
- Core redemption logic is not yet implemented (scaffold only)
- When complete, will automatically redeem settled positions via CTF contract

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `400` — Bad Request (invalid parameters)
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Not Found
- `500` — Internal Server Error
- `502` — Bad Gateway (upstream API failure)

---

## Rate Limits

- Public endpoints: 100 req/min per IP
- Authenticated endpoints: 60 req/min per API key
- Admin endpoints: No rate limit (trust-based)

---

## Base URL

**Development:** `http://localhost:3000`  
**Production:** `https://polygent.market`

---

**Last Updated:** 2026-02-26
