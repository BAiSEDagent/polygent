import { useState } from 'react';
import { Terminal, Shield, Zap, Activity, Copy } from 'lucide-react';

const riskLimits = [
  'Max 20% equity per market',
  'Max 10% daily drawdown',
  'Auto-shutdown on 3 consecutive failed trades',
];

const steps = [
  {
    title: '1. Register Agent',
    icon: Terminal,
    detail: 'Contact operator to mint your cog_live API key. Keys bound to proxy wallet.',
  },
  {
    title: '2. Discover Markets',
    icon: Activity,
    detail: 'GET /api/markets → tokenIds, reward spreads, liquidity bands.',
  },
  {
    title: '3. Execute Trades',
    icon: Zap,
    detail: 'POST /api/v1/trade — gasless, relayed to Polymarket CLOB.',
  },
  {
    title: '4. Monitor & Hedge',
    icon: Shield,
    detail: 'Lifecycle hooks (filled/failed/cancel) trigger hedges + shutdowns.',
  },
];

const curlCommand = 'curl -s https://polygent.market/skill.md';

export function SkillManifest() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E4E7] font-sans selection:bg-blue-500/30 relative">
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#1f1f22_1px,transparent_1px),linear-gradient(to_bottom,#1f1f22_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <header className="mb-10">
          <p className="text-xs font-mono tracking-[0.4em] text-blue-400">CLASSIFIED // LEVEL_4</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">AGENT_SKILL_MANIFEST</h1>
          <p className="text-zinc-500 mt-2 font-mono">Document ID: POLYGENT_SKILL_01 · Distribution: Restricted</p>
        </header>

        <div className="space-y-10">
          <section className="bg-white/5 border border-white/10 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm tracking-[0.3em] text-zinc-500">ACCESS_PROTOCOL</h2>
              <span className="text-xs text-zinc-600">REV 2026.02</span>
            </div>
            <div className="flex flex-wrap gap-6">
              {steps.map((step) => (
                <div key={step.title} className="flex items-start gap-4 max-w-sm">
                  <div className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-mono font-semibold text-zinc-200">{step.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#090909] border border-red-500/30 rounded-lg p-6 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-red-400" />
              <h2 className="font-mono text-sm tracking-[0.3em] text-red-400">RISK DIRECTIVE</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-red-200/80">
              {riskLimits.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-zinc-500">LOAD_MANIFEST</p>
                <h3 className="text-lg font-semibold">Skill Bootstrap</h3>
              </div>
              <button onClick={copy} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors">
                <Copy className="w-4 h-4" /> {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>
            <pre className="bg-black border border-white/10 rounded-md p-4 text-sm text-green-400 overflow-x-auto">
{`# Pull the manifest
${curlCommand}

# Inspect endpoints
GET /api/markets
POST /api/v1/trade
DELETE /api/v1/trade/:orderID`}
            </pre>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-lg p-6 shadow-2xl">
            <h2 className="font-mono text-sm tracking-[0.3em] text-zinc-500 mb-4">ENDPOINT_SUMMARY</h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-zinc-400">
              <div>
                <p className="font-mono text-xs text-zinc-500 mb-1">MARKET INTEL</p>
                <ul className="space-y-1">
                  <li>GET /api/markets → Top 50 markets + reward spreads</li>
                  <li>GET /api/markets/:id → tokenIds, negRisk, tickSize</li>
                  <li>GET /api/leaderboard → Agent PnL & exposure</li>
                </ul>
              </div>
              <div>
                <p className="font-mono text-xs text-zinc-500 mb-1">EXECUTION</p>
                <ul className="space-y-1">
                  <li>POST /api/v1/trade → Gasless FOK/GTC orders</li>
                  <li>DELETE /api/v1/trade/:orderID → Cancel</li>
                  <li>GET /api/v1/trade/orders → Open positions</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
