import { useState } from 'react';
import CopyDelegationModal from './agent/CopyDelegationModal';

interface AgentProfileProps {
  agent: any;
  onClose: () => void;
}

/** VS Code–style syntax line */
function CodeLine({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex hover:bg-white/[0.02] transition-colors">
      <span className="select-none w-8 shrink-0 text-right pr-3 text-[11px] text-zinc-700">{String(num).padStart(2, '0')}</span>
      <span className="text-[11px] leading-relaxed">{children}</span>
    </div>
  );
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-400">{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-400">{children}</span>;
}
function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-400">{children}</span>;
}
function Num({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-300">{children}</span>;
}
function Cmt({ children }: { children: React.ReactNode }) {
  return <span className="text-zinc-600 italic">{children}</span>;
}

export function AgentProfile({ agent, onClose }: AgentProfileProps) {
  const [allocation, setAllocation] = useState('1000');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const pnl = agent.totalPnl ?? 0;
  const pnlPct = agent.totalPnlPct ?? 0;
  const equity = agent.currentEquity ?? 0;
  const winRate = agent.winRate ?? 0;
  const drawdown = agent.maxDrawdown ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl border border-white/10 bg-[#050505] rounded-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          <div className="flex gap-5">
            <div className="w-16 h-16 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-sm">
              <span className="text-2xl text-primary">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold font-mono text-header tracking-tight">
                  {agent.agentName?.toUpperCase().replace(/ /g, '_') || 'AGENT'}
                </h1>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-[10px] text-success uppercase">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                  Online
                </span>
              </div>
              <p className="text-sm text-zinc-500 font-mono">0x55ea...d922 · Deployed 1d ago</p>
            </div>
          </div>
          <button onClick={() => setIsCopyModalOpen(true)} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-mono font-bold px-6 py-2.5 rounded-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.45)] text-[12px] uppercase tracking-tighter">
            ⚡ COPY STRATEGY
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 divide-x divide-white/10 border-b border-white/10 bg-[#050505]">
          {[
            { label: 'Total ROI', value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`, color: pnl >= 0 ? 'text-success' : 'text-danger' },
            { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: 'text-header' },
            { label: 'Max Drawdown', value: `${drawdown > 0 ? '-' : ''}${(drawdown * 100).toFixed(1)}%`, color: drawdown > 0.1 ? 'text-danger' : 'text-header' },
            { label: 'Copiers (AUM)', value: `$${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: 'text-primary' },
          ].map((stat, i) => (
            <div key={i} className="p-5">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{stat.label}</div>
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-3 gap-8">
          {/* Left: Strategy Manifest — VS Code style */}
          <div className="col-span-2 space-y-4">
            {/* Editor chrome */}
            <div className="border border-white/[0.06] rounded-sm overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center bg-[#020202] border-b border-white/[0.06] px-3 py-1.5">
                <div className="flex items-center gap-1.5 mr-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                </div>
                <span className="text-[10px] text-muted px-3 py-0.5 bg-white/[0.04] rounded-sm border border-white/[0.06]">
                  strategy.manifest.ts
                </span>
              </div>

              {/* Code body */}
              <div className="bg-[#020202] px-1 py-3 font-mono overflow-x-auto">
                <CodeLine num={1}><Cmt>// Agent Strategy Configuration</Cmt></CodeLine>
                <CodeLine num={2}><Kw>import</Kw> {'{'} <Fn>Strategy</Fn>, <Fn>RiskModel</Fn> {'}'} <Kw>from</Kw> <Str>'@polygent/core'</Str>;</CodeLine>
                <CodeLine num={3}>&nbsp;</CodeLine>
                <CodeLine num={4}><Kw>export const</Kw> <Fn>STRATEGY_INIT</Fn> = {'{'}</CodeLine>
                <CodeLine num={5}>  name: <Str>'{agent.agentName || 'Agent'}'</Str>,</CodeLine>
                <CodeLine num={6}>  <Cmt>// Monitors prediction markets for YES/NO divergence</Cmt></CodeLine>
                <CodeLine num={7}>  scanner: <Fn>GammaAPI</Fn>.<Fn>connect</Fn>({'{'} markets: <Num>50</Num>, refresh: <Str>'realtime'</Str> {'}'}),</CodeLine>
                <CodeLine num={8}>  threshold: <Num>0.045</Num>, <Cmt>// Min 4.5% spread to enter</Cmt></CodeLine>
                <CodeLine num={9}>{'};'}</CodeLine>
                <CodeLine num={10}>&nbsp;</CodeLine>
                <CodeLine num={11}><Kw>export const</Kw> <Fn>EXECUTION</Fn> = {'{'}</CodeLine>
                <CodeLine num={12}>  entry: <Str>'spread &gt; 4.5%'</Str>,</CodeLine>
                <CodeLine num={13}>  exit: <Str>'spread &lt; 1.0% || event.resolved'</Str>,</CodeLine>
                <CodeLine num={14}>  settlement: <Str>'gasless_relayer'</Str>,</CodeLine>
                <CodeLine num={15}>  orderType: <Str>'GTC'</Str>,</CodeLine>
                <CodeLine num={16}>{'};'}</CodeLine>
                <CodeLine num={17}>&nbsp;</CodeLine>
                <CodeLine num={18}><Kw>export const</Kw> <Fn>RISK_MODEL</Fn>: <Fn>RiskModel</Fn> = {'{'}</CodeLine>
                <CodeLine num={19}>  circuitBreaker: <Num>-0.15</Num>, <Cmt>// Hard stop at -15% drawdown</Cmt></CodeLine>
                <CodeLine num={20}>  maxConcentration: <Num>0.25</Num>, <Cmt>// 25% max per market</Cmt></CodeLine>
                <CodeLine num={21}>  dailyLossLimit: <Kw>true</Kw>,</CodeLine>
                <CodeLine num={22}>  enforcer: <Str>'on-chain'</Str>,</CodeLine>
                <CodeLine num={23}>{'};'}</CodeLine>
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-2">
              {['#arbitrage', '#delta-neutral', '#low-risk', '#polymarket'].map(tag => (
                <span key={tag} className="px-2 py-1 bg-border/50 rounded-sm text-[10px] text-muted">{tag}</span>
              ))}
            </div>

            {/* Execution Log */}
            <div className="flex items-center gap-2 mb-2 mt-2">
              <span className="text-muted">{'>'}_</span>
              <h3 className="text-sm font-bold text-header uppercase">Recent Execution</h3>
            </div>
            <div className="bg-[#020202] border border-white/[0.06] rounded-sm p-3 text-[11px] text-muted max-h-[100px] overflow-y-auto">
              <p className="text-header">[READY] {agent.agentName} initialized. Scanning markets...</p>
              <p className="text-success">[SCAN] 50 markets loaded. 4 arbitrage opportunities detected.</p>
              <p className="text-primary">[ORDER] BUY 5 @ $0.02 — "Will Trump deport 750k+"</p>
              <p className="text-success">[FILL] Order 0x30e4...ccd8 — status: LIVE</p>
              <p className="text-warning">[RISK] Exposure: $5.99 / $50.00 (12%)</p>
            </div>
          </div>

          {/* Right: Risk Controls */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-muted">🛡</span>
              <h3 className="text-sm font-bold text-header uppercase">Risk Controls</h3>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                { label: 'Max Leverage', value: '1.0x (Spot)' },
                { label: 'Stop Loss', value: 'Hard @ -15%' },
                { label: 'Asset Class', value: 'Politics / Crypto' },
                { label: 'Avg Hold Time', value: '4h 12m' },
                { label: 'Min Order', value: '5 shares' },
                { label: 'Settlement', value: 'Auto on resolve' },
              ].map((item, i) => (
                <li key={i} className="flex justify-between items-center text-[12px] border-b border-border/50 pb-2">
                  <span className="text-muted">{item.label}</span>
                  <span className="text-header">{item.value}</span>
                </li>
              ))}
            </ul>

            <label className="text-[10px] text-muted uppercase tracking-wider">USDC ALLOCATION</label>
            <input
              value={allocation}
              onChange={e => setAllocation(e.target.value)}
              className="mt-1.5 w-full bg-void border border-border rounded-sm px-3 py-2.5 text-sm text-header focus:border-success/50 focus:outline-none transition-colors"
              type="number"
              min={50}
            />
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {['100', '500', '1000', '5000'].map(v => (
                <button
                  key={v}
                  onClick={() => setAllocation(v)}
                  className={`text-[10px] py-1.5 border rounded-sm transition-colors ${
                    allocation === v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:border-primary/30'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
            <button className="mt-4 w-full bg-[#22c55e] hover:bg-[#4ade80] text-black font-bold py-3 rounded-sm transition-all flex items-center justify-center gap-2 text-[12px] uppercase tracking-wider shadow-[0_0_18px_rgba(34,197,94,0.35)]">
              ↑ DEPLOY COPY-TRADE
            </button>
            <p className="mt-2 text-[10px] text-muted/50 text-center">20% performance fee on profits only.</p>
          </div>
        </div>

        {/* Close */}
        <div className="border-t border-border p-3 text-center">
          <button onClick={onClose} className="text-[11px] text-muted hover:text-header transition-colors tracking-wider">
            [ ESC TO CLOSE ]
          </button>
        </div>
      </div>

      {isCopyModalOpen && (
        <CopyDelegationModal
          agentId={agent.id || agent.agentName || 'unknown-agent'}
          agentName={agent.agentName || 'Agent'}
          onClose={() => setIsCopyModalOpen(false)}
        />
      )}
    </div>
  );
}
