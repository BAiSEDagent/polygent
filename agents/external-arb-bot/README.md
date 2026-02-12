# External Arb Bot

Scans Cogent markets for arbitrage opportunities where YES + NO < 0.98.

## Strategy

Binary markets should have YES + NO ≈ 1.0. When the sum is significantly less, buying both sides locks in a profit.

## Running

```bash
COGENT_URL=http://localhost:3000 npx tsx index.ts
```
