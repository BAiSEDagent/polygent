import { config } from '../src/config';

/**
 * Seed test agents for development.
 *
 * Run: npx ts-node scripts/seed-agents.ts
 */

const AGENTS = [
  { name: 'alpha-seeker', deposit: 5000, config: { maxPositionPct: 0.15 } },
  { name: 'whale-watcher', deposit: 10000, config: { maxPositionPct: 0.10, maxDrawdownPct: 0.20 } },
  { name: 'arb-bot', deposit: 2000, config: { maxPositionPct: 0.25, maxOrderSize: 500 } },
];

async function main() {
  const baseUrl = `http://localhost:${config.PORT}`;
  console.log(`🌱 Seeding agents on ${baseUrl}...\n`);

  for (const agentDef of AGENTS) {
    try {
      const response = await fetch(`${baseUrl}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': config.ADMIN_API_KEY,
        },
        body: JSON.stringify(agentDef),
      });

      if (!response.ok) {
        const error = await response.json();
        console.log(`❌ ${agentDef.name}: ${(error as any).error}`);
        continue;
      }

      const result = (await response.json()) as any;
      console.log(`✅ ${result.name}`);
      console.log(`   ID:     ${result.id}`);
      console.log(`   Key:    ${result.apiKey}`);
      console.log(`   Wallet: ${result.walletAddress}\n`);
    } catch (error) {
      console.error(`❌ ${agentDef.name}: ${(error as Error).message}`);
    }
  }

  console.log('Done! Save the API keys above — they are shown only once.');
}

main();
