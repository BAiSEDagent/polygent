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

  const pnl      = agent.totalPnl    ?? 0;
  const pnlPct   = agent.totalPnlPct ?? 0;
  const equity   = agent.currentEquity ?? 0;
  const winRate  = agent.winRate     ?? 0;
  const drawdown = agent.maxDrawdown ?? 0;

  // Resolve ROI / drawdown colors statically so JIT keeps them
  const roiColor      = pnl >= 0     ? '#22c55e' : '#ef4444';
  const drawdownColor = drawdown > 0.1 ? '#ef4444' : '#f4f4f5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl border border-white/10 rounded-sm overflow-hidden"
        style={{ background: '#050505' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div
          className="p-6 border-b border-white/10 flex items-start justify-between"
          style={{
            backgroundColor: '#050505',
            backgroundImage:
              'linear-gradient(to right, rgba(100,116,139,0.18) 1px, transparent 1px), ' +
              'linear-gradient(to bottom, rgba(100,116,139,0.18) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="flex gap-5">
            {/* Agent icon */}
            <div
              className="w-16 h-16 flex items-center justify-center rounded-sm"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
            >
              <span style={{ fontSize: '1.5rem', color: '#3b82f6' }}>⚡</span>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-1">
                {/* Title — Bold Monospace */}
                <h1 className="text-2xl font-bold font-mono tracking-tight" style={{ color: '#f4f4f5' }}>
                  {agent.agentName?.toUpperCase().replace(/ /g, '_') || 'AGENT'}
                </h1>

                {/* ONLINE pill — green border ghost, matching reference */}
                <span
                  className="flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase"
                  style={{
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid #22c55e',
                    color: '#22c55e',
                    borderRadius: '9999px',
                  }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#22c55e' }} />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#22c55e' }} />
                  </span>
                  ONLINE
                </span>
              </div>

              <p className="text-sm font-mono" style={{ color: '#52525b' }}>
                0x55ea...d922 · Deployed 1d ago
              </p>
            </div>
          </div>

          {/* COPY STRATEGY — Electric Blue */}
          <button
            onClick={() => setIsCopyModalOpen(true)}
            className="font-mono font-bold px-6 py-2.5 rounded-sm transition-all flex items-center gap-2 text-[12px] uppercase tracking-tighter"
            style={{
              background: '#3b82f6',
              color: '#fff',
              boxShadow: '0 0 18px rgba(59,130,246,0.5)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}
          >
            ⚡ COPY STRATEGY
          </button>
        </div>

        {/* ── STATS GRID ─────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-4 divide-x border-b"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.08)', '--tw-divide-opacity': 1 } as any}
        >
          {[
            { label: 'TOTAL ROI',      value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`, color: roiColor },
            { label: 'WIN RATE',       value: `${winRate.toFixed(1)}%`,                          color: '#f4f4f5' },
            { label: 'MAX DRAWDOWN',   value: `${drawdown > 0 ? '' : ''}${(drawdown * 100).toFixed(1)}%`, color: drawdownColor },
            { label: 'COPIERS (AUM)',  value: `$${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: '#3b82f6' },
          ].map((stat, i) => (
            <div key={i} className="p-5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#71717a' }}>{stat.label}</div>
              <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        <div className="p-6 grid grid-cols-3 gap-8">

          {/* LEFT — Strategy Manifest */}
          <div className="col-span-2 space-y-4">

            {/* VS Code editor chrome */}
            <div className="rounded-sm overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Tab bar */}
              <div
                className="flex items-center px-3 py-1.5"
                style={{ background: '#020202', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-1.5 mr-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444', opacity: 0.75 }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b', opacity: 0.75 }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e', opacity: 0.75 }} />
                </div>
                <span
                  className="text-[10px] px-3 py-0.5 rounded-sm"
                  style={{
                    color: '#71717a',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  strategy.manifest.ts
                </span>
              </div>

              {/* Code body */}
              <div className="px-1 py-3 font-mono overflow-x-auto" style={{ background: '#020202' }}>
                <CodeLine num={1}><Cmt>// Agent Strategy Configuration</Cmt></CodeLine>
                <CodeLine num={2}><Kw>import</Kw> {'{'} <Fn>Strategy</Fn>, <Fn>RiskModel</Fn> {'}'} <Kw>from</Kw> <Str>'@polygent/core'</Str>;</CodeLine>
                <CodeLine num={3}>&nbsp;</CodeLine>
                <CodeLine num={4}><Kw>export const</Kw> <Fn>STRATEGY_INIT</Fn> = {'{'}</CodeLine>
                <CodeLine num={5}>{'  '}name: <Str>'{agent.agentName || 'Agent'}'</Str>,</CodeLine>
                <CodeLine num={6}>{'  '}<Cmt>// Monitors prediction markets for YES/NO divergence</Cmt></CodeLine>
                <CodeLine num={7}>{'  '}scanner: <Fn>GammaAPI</Fn>.<Fn>connect</Fn>({'{'} markets: <Num>50</Num>, refresh: <Str>'realtime'</Str> {'}'}),</CodeLine>
                <CodeLine num={8}>{'  '}threshold: <Num>0.045</Num>, <Cmt>// Min 4.5% spread to enter</Cmt></CodeLine>
                <CodeLine num={9}>{'};'}</CodeLine>
                <CodeLine num={10}>&nbsp;</CodeLine>
                <CodeLine num={11}><Kw>export const</Kw> <Fn>EXECUTION</Fn> = {'{'}</CodeLine>
                <CodeLine num={12}>{'  '}entry: <Str>'spread &gt; 4.5%'</Str>,</CodeLine>
                <CodeLine num={13}>{'  '}exit: <Str>'spread &lt; 1.0% || event.resolved'</Str>,</CodeLine>
                <CodeLine num={14}>{'  '}settlement: <Str>'gasless_relayer'</Str>,</CodeLine>
                <CodeLine num={15}>{'  '}orderType: <Str>'GTC'</Str>,</CodeLine>
                <CodeLine num={16}>{'};'}</CodeLine>
                <CodeLine num={17}>&nbsp;</CodeLine>
                <CodeLine num={18}><Kw>export const</Kw> <Fn>RISK_MODEL</Fn>: <Fn>RiskModel</Fn> = {'{'}</CodeLine>
                <CodeLine num={19}>{'  '}circuitBreaker: <Num>-0.15</Num>, <Cmt>// Hard stop at -15% drawdown</Cmt></CodeLine>
                <CodeLine num={20}>{'  '}maxConcentration: <Num>0.25</Num>, <Cmt>// 25% max per market</Cmt></CodeLine>
                <CodeLine num={21}>{'  '}dailyLossLimit: <Kw>true</Kw>,</CodeLine>
                <CodeLine num={22}>{'  '}enforcer: <Str>'on-chain'</Str>,</CodeLine>
                <CodeLine num={23}>{'};'}</CodeLine>
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-2">
              {['#arbitrage', '#delta-neutral', '#low-risk', '#polymarket'].map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-sm text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#71717a', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Recent Execution */}
            <div className="flex items-center gap-2 mt-2 mb-2">
              <span style={{ color: '#71717a' }}>&gt;_</span>
              <h3 className="text-sm font-bold font-mono uppercase" style={{ color: '#f4f4f5' }}>
                Recent Execution
              </h3>
            </div>
            <div
              className="p-3 text-[11px] font-mono max-h-[110px] overflow-y-auto rounded-sm"
              style={{ background: '#020202', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* [READY] — white */}
              <p style={{ color: '#f4f4f5' }}>[READY] {agent.agentName} initialized. Scanning markets...</p>
              {/* [SCAN]  — neon green */}
              <p style={{ color: '#22c55e' }}>[SCAN] 50 markets loaded. 4 arbitrage opportunities detected.</p>
              {/* [ORDER] — electric blue */}
              <p style={{ color: '#3b82f6' }}>[ORDER] BUY 5 @ $0.02 — "Will Trump deport 750k+"</p>
              {/* [FILL]  — green */}
              <p style={{ color: '#22c55e' }}>[FILL] Order 0x30e4...ccd8 — status: LIVE</p>
              {/* [RISK]  — amber */}
              <p style={{ color: '#f59e0b' }}>[RISK] Exposure: $5.99 / $50.00 (12%)</p>
            </div>
          </div>

          {/* RIGHT — Risk Controls */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span>🛡️</span>
              <h3 className="text-sm font-bold font-mono uppercase" style={{ color: '#f4f4f5' }}>
                Risk Controls
              </h3>
            </div>

            <ul className="space-y-3 mb-6">
              {[
                { label: 'Max Leverage',  value: '1.0x (Spot)' },
                { label: 'Stop Loss',     value: 'Hard @ -15%' },
                { label: 'Asset Class',   value: 'Politics / Crypto' },
                { label: 'Avg Hold Time', value: '4h 12m' },
                { label: 'Min Order',     value: '5 shares' },
                { label: 'Settlement',    value: 'Auto on resolve' },
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-[12px] pb-2"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span style={{ color: '#71717a' }}>{item.label}</span>
                  <span style={{ color: '#f4f4f5' }}>{item.value}</span>
                </li>
              ))}
            </ul>

            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#71717a' }}>
              USDC ALLOCATION
            </label>
            <input
              value={allocation}
              onChange={e => setAllocation(e.target.value)}
              className="mt-1.5 w-full rounded-sm px-3 py-2.5 text-sm focus:outline-none transition-colors"
              style={{
                background: '#050505',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#f4f4f5',
              }}
              type="number"
              min={50}
            />

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {['100', '500', '1000', '5000'].map(v => (
                <button
                  key={v}
                  onClick={() => setAllocation(v)}
                  className="text-[10px] py-1.5 rounded-sm transition-colors"
                  style={
                    allocation === v
                      ? { background: 'rgba(59,130,246,0.12)', border: '1px solid #3b82f6', color: '#3b82f6' }
                      : { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#71717a' }
                  }
                >
                  ${v}
                </button>
              ))}
            </div>

            {/* DEPLOY — Neon Mint */}
            <button
              className="mt-4 w-full font-bold py-3 rounded-sm transition-all flex items-center justify-center gap-2 text-[12px] uppercase tracking-wider"
              style={{
                background: '#22c55e',
                color: '#000',
                boxShadow: '0 0 20px rgba(34,197,94,0.4)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#4ade80')}
              onMouseLeave={e => (e.currentTarget.style.background = '#22c55e')}
            >
              ↑ DEPLOY COPY-TRADE
            </button>
            <p className="mt-2 text-[10px] text-center" style={{ color: 'rgba(113,113,122,0.6)' }}>
              20% performance fee on profits only.
            </p>
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <div className="p-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={onClose}
            className="text-[11px] tracking-wider transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f4f4f5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
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
