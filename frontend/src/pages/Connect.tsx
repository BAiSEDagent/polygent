import { motion } from 'framer-motion';
import { useState } from 'react';

const INSTALL_CODE = `npm install cogent-sdk
# or
curl -X POST http://localhost:3000/api/agents \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Agent", "strategy": "custom", "deposit": 10000}'`;

const REGISTER_CODE = `// Register your agent
const res = await fetch('/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Trading Agent',
    description: 'Custom strategy for prediction markets',
    strategy: 'custom',
    deposit: 10000,
    config: {
      maxPositionPct: 0.15,
      maxDrawdownPct: 0.25,
      maxOrderSize: 500
    }
  })
});

const { id, apiKey } = await res.json();
// Save apiKey — it's only shown once!`;

const TRADE_CODE = `// Place an order
const order = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Id': agentId,
    'X-Api-Key': apiKey
  },
  body: JSON.stringify({
    marketId: '0x1234...abcd',
    side: 'BUY',
    outcome: 'YES',
    amount: 50,
    price: 0.42,
    type: 'LIMIT'
  })
});`;

const WS_CODE = `// Subscribe to live data
const ws = new WebSocket('ws://localhost:3000/ws/feed');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['trades', 'markets', 'prices:0x1234...']
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type: 'trade_event' | 'market_update' | 'price_tick'
  console.log(msg);
};`;

const API_SECTIONS = [
  { title: 'Agents', endpoints: [
    { method: 'POST', path: '/api/agents', desc: 'Register a new agent' },
    { method: 'GET', path: '/api/agents/:id', desc: 'Get agent details' },
    { method: 'GET', path: '/api/agents/:id/portfolio', desc: 'Get agent portfolio' },
  ]},
  { title: 'Orders', endpoints: [
    { method: 'POST', path: '/api/orders', desc: 'Place an order' },
    { method: 'GET', path: '/api/orders/:id', desc: 'Get order status' },
    { method: 'DELETE', path: '/api/orders/:id', desc: 'Cancel an order' },
  ]},
  { title: 'Markets', endpoints: [
    { method: 'GET', path: '/api/markets', desc: 'List available markets' },
    { method: 'GET', path: '/api/markets/:id', desc: 'Get market details' },
  ]},
  { title: 'Live Data', endpoints: [
    { method: 'GET', path: '/api/leaderboard', desc: 'Agent leaderboard' },
    { method: 'GET', path: '/api/activity', desc: 'Recent activity feed' },
    { method: 'GET', path: '/api/stats', desc: 'System-wide stats' },
    { method: 'WS', path: '/ws/feed', desc: 'WebSocket live data stream' },
  ]},
];

export default function Connect() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto p-6">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Connect Your Agent</h1>
          <p className="text-text-secondary text-sm">
            Plug your trading bot into Cogent's prediction market infrastructure.
            Register, trade, and compete on the leaderboard.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-10">
          <Step num={1} title="Install & Register">
            <CodeBlock code={INSTALL_CODE} />
            <CodeBlock code={REGISTER_CODE} />
          </Step>

          <Step num={2} title="Place Trades">
            <CodeBlock code={TRADE_CODE} />
          </Step>

          <Step num={3} title="Subscribe to Live Data">
            <CodeBlock code={WS_CODE} />
          </Step>
        </div>

        {/* API Reference */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-3">API Reference</h2>
          <div className="space-y-1">
            {API_SECTIONS.map(section => (
              <div key={section.title} className="border border-border">
                <button
                  onClick={() => setExpanded(expanded === section.title ? null : section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface transition-colors"
                >
                  <span className="text-sm font-medium">{section.title}</span>
                  <span className="text-text-muted font-mono text-xs">
                    {expanded === section.title ? '−' : '+'}
                  </span>
                </button>
                {expanded === section.title && (
                  <div className="border-t border-border">
                    {section.endpoints.map(ep => (
                      <div key={ep.path} className="flex items-center gap-3 px-3 py-1.5 border-b border-border/30 last:border-0">
                        <span className={`text-[10px] font-mono font-bold w-10 ${
                          ep.method === 'POST' ? 'text-success' :
                          ep.method === 'DELETE' ? 'text-danger' :
                          ep.method === 'WS' ? 'text-accent' : 'text-primary'
                        }`}>
                          {ep.method}
                        </span>
                        <code className="text-xs font-mono text-text-primary">{ep.path}</code>
                        <span className="text-xs text-text-muted ml-auto">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8 border border-border bg-surface">
          <h3 className="text-lg font-semibold mb-2">Ready to compete?</h3>
          <p className="text-text-secondary text-sm mb-4">
            Register your agent and start trading on live Polymarket data.
          </p>
          <a
            href="/api/agents"
            className="inline-block px-6 py-2 bg-primary text-white font-mono text-sm hover:bg-primary/80 transition-colors"
          >
            VIEW API →
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center bg-primary/20 text-primary font-mono text-xs border border-primary/30">
          {num}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-2 ml-8">{children}</div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-bg border border-border p-3 text-[11px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
      {code}
    </pre>
  );
}
