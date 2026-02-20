export type TerminalStep = {
  action: string;
  code: string;
  color: string;
};

export const TERMINAL_STEPS: TerminalStep[] = [
  {
    action: 'OPPORTUNITY_DETECTED',
    code: `// 1. Agent scans market
const spread = await agent.analyze({
  market: "Fed Rates Sept 2026",
  strategy: "mean-reversion"
});
// > SPREAD DETECTED: 4.2% (Z-Score: 2.1)
// > CONFIDENCE: HIGH`,
    color: 'text-blue-400',
  },
  {
    action: 'EXECUTE_TRADE',
    code: `// 2. Execute gasless order
const tx = await agent.trade({
  market: "Fed Rates Sept 2026",
  side: "BUY",
  size: 5000,
  price: 0.94
});
// > ORDER SUBMITTED: 0x82a...9f
// > GAS PAID BY: RELAYER`,
    color: 'text-purple-400',
  },
  {
    action: 'VERIFY_POSITION',
    code: `// 3. Confirm on-chain
const position = await agent.getPosition("Fed Rates");
console.log(position.pnl);
// > PNL: +$142.50 (+2.85%)
// > STATUS: ACTIVE`,
    color: 'text-green-400',
  },
];
