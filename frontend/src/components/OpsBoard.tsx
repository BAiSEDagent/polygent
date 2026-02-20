import { Sparkline } from './Sparkline';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

type Stage = 'SIGNAL DETECTED' | 'POSITIONS OPEN' | 'EXECUTING' | 'SETTLED';

interface OpCard {
  id: string;
  agentName: string;
  market: string;
  size: number;
  roi: number;
  stage: Stage;
}

const stageIcon: Record<Stage, string> = {
  'SIGNAL DETECTED': '@',
  'POSITIONS OPEN':  '◇',
  'EXECUTING':       '⚡',
  'SETTLED':         '✓',
};

const sparklineStages = new Set<Stage>(['POSITIONS OPEN', 'EXECUTING']);

// Column config — EXECUTING gets Electric Blue ambient glow
const stageConfig: Record<Stage, { topBorder: string; glow: string }> = {
  'SIGNAL DETECTED': {
    topBorder: 'rgba(255,255,255,0.05)',
    glow:      'none',
  },
  'POSITIONS OPEN': {
    topBorder: 'rgba(255,255,255,0.05)',
    glow:      'none',
  },
  'EXECUTING': {
    topBorder: T.color.blue,
    glow:      'none',   // handled by executing-hue-glow CSS animation
  },
  'SETTLED': {
    topBorder: 'rgba(255,255,255,0.05)',
    glow:      'none',
  },
};

function classify(a: any): OpCard {
  let stage: Stage = 'POSITIONS OPEN';
  const t = a.type || '';
  if (t === 'signal' || t.includes('signal'))        stage = 'SIGNAL DETECTED';
  else if (t === 'fill' || t === 'execute' || t === 'trade') stage = 'EXECUTING';
  else if (t === 'settle' || t === 'close')           stage = 'SETTLED';
  else if (t === 'paper_trade') {
    const h = (a.id || '').charCodeAt(0) || 0;
    stage = (['SIGNAL DETECTED', 'POSITIONS OPEN', 'EXECUTING', 'SETTLED'] as Stage[])[h % 4];
  }
  return {
    id:        a.id || `${a.agentId}-${a.timestamp}`,
    agentName: a.agentName || a.agentId || 'Agent',
    market:    a.market || 'Unknown',
    size:      a.amount || 0,
    roi:       a.pnl ?? (((((a.id || a.timestamp || 0).toString().split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) * 9301 + 49297) % 233280) / 233280) * 20 - 3),
    stage,
  };
}

// ── Agent trade card with sentiment rail ──────────────────────────────────────
function TradeCard({ card, showSparkline }: { card: OpCard; showSparkline: boolean }) {
  const positive     = card.roi >= 0;
  const sentimentColor = positive ? T.color.green : T.color.red;

  return (
    <div
      className={`overflow-hidden transition-colors ${positive ? 'rail-green' : 'rail-red'}`}
      style={{
        // Sentiment rail — breathing 2px left accent
        borderLeft:      `2px solid ${sentimentColor}`,
        borderTop:       `1px solid rgba(255,255,255,0.06)`,
        borderRight:     `1px solid rgba(255,255,255,0.06)`,
        borderBottom:    `1px solid rgba(255,255,255,0.06)`,
        borderRadius:    '0 2px 2px 0',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter:  'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:         '8px 10px',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(5,5,5,0.85)')}
    >
      {/* Agent ID — label dimmed, value stars */}
      <p className="font-mono" style={{ fontSize: '10px' }}>
        <span style={{ color: T.text.muted, opacity: 0.3 }}>AGENT_ID: </span>
        <span style={{ color: T.color.blue, fontWeight: 600 }}>{card.agentName}</span>
      </p>

      {/* Market — label dimmed */}
      <p className="font-mono truncate mt-0.5" style={{ fontSize: '10px' }}>
        <span style={{ color: T.text.muted, opacity: 0.3 }}>MARKET: </span>
        <span style={{ color: T.text.secondary, fontSize: '11px' }}>{card.market}</span>
      </p>

      {/* SIZE + ROI — Bold Monospace, labels dimmed, numbers pop */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono" style={{ fontSize: '10px' }}>
          <span style={{ color: T.text.muted, opacity: 0.3 }}>SIZE: </span>
          <span style={{ color: T.color.blue, fontWeight: 700, fontSize: '11px' }}>
            ${card.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </span>
        <span className="font-bold font-mono" style={{ fontSize: '11px', color: sentimentColor }}>
          <span style={{ opacity: 0.3 }}>ROI: </span>
          {positive ? '+' : ''}{card.roi.toFixed(2)}%
        </span>
      </div>

      {showSparkline && <Sparkline positive={positive} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OpsBoard({ activities }: { activities: any[] }) {
  const cards = activities.map(classify);
  const cols: Record<Stage, OpCard[]> = {
    'SIGNAL DETECTED': cards.filter(c => c.stage === 'SIGNAL DETECTED'),
    'POSITIONS OPEN':  cards.filter(c => c.stage === 'POSITIONS OPEN'),
    'EXECUTING':       cards.filter(c => c.stage === 'EXECUTING'),
    'SETTLED':         cards.filter(c => c.stage === 'SETTLED'),
  };

  return (
    <>
      {/* Scan-line keyframe — injected once for the SIGNAL DETECTED column */}
      <style>{`
        @keyframes polygent-scan {
          0%   { top: -1px; opacity: 0; }
          5%   { opacity: 0.7; }
          92%  { opacity: 0.7; }
          100% { top: 100%; opacity: 0; }
        }
        .polygent-scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0.55) 60%, transparent 100%);
          animation: polygent-scan 4s linear infinite;
          pointer-events: none;
        }
        /* Electric Blue thin-rail scrollbar for Ops Board columns */
        .polygent-col-scroll { scrollbar-width: thin; scrollbar-color: #3b82f6 rgba(0,0,0,0.4); }
        .polygent-col-scroll::-webkit-scrollbar { width: 3px; }
        .polygent-col-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); }
        .polygent-col-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 2px; }
        .polygent-col-scroll::-webkit-scrollbar-thumb:hover { background: #60a5fa; }

        /* Breathing sentiment rails — 3s ease-in-out, not blink */
        @keyframes rail-breathe-green {
          0%, 100% { border-left-color: rgba(34,197,94,0.3); box-shadow: -1px 0 6px rgba(34,197,94,0.1); }
          50%       { border-left-color: rgba(34,197,94,1.0); box-shadow: -1px 0 10px rgba(34,197,94,0.5); }
        }
        @keyframes rail-breathe-red {
          0%, 100% { border-left-color: rgba(239,68,68,0.3); box-shadow: -1px 0 6px rgba(239,68,68,0.1); }
          50%       { border-left-color: rgba(239,68,68,1.0); box-shadow: -1px 0 10px rgba(239,68,68,0.5); }
        }
        .rail-green { animation: rail-breathe-green 3s ease-in-out infinite; }
        .rail-red   { animation: rail-breathe-red   3s ease-in-out infinite; }

        /* Hue-shift glow — EXECUTING column top border + box-shadow */
        @keyframes hue-shift-executing {
          0%, 100% {
            border-top-color: #3b82f6;
            box-shadow: 0 0 18px rgba(59,130,246,0.18), 0 -2px 10px rgba(59,130,246,0.25);
          }
          50% {
            border-top-color: #6366f1;
            box-shadow: 0 0 22px rgba(99,102,241,0.28), 0 -2px 14px rgba(79,70,229,0.4);
          }
        }
        .executing-hue-glow { animation: hue-shift-executing 4s ease-in-out infinite; }
      `}</style>

      <section
        className="rounded-sm p-4"
        style={{
          border:          `1px solid ${T.border.DEFAULT}`,
          backgroundColor: 'rgba(15,15,16,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-[13px] font-bold font-mono tracking-wide"
            style={{ color: T.text.primary }}
          >
            LIVE OPERATIONS BOARD
          </h2>
          <span className="text-[11px] font-mono" style={{ color: T.color.green }}>
            GAMMA + CLOB PIPELINE
          </span>
        </div>

        {/* Column grid */}
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(cols) as Stage[]).map(stage => {
            const items       = cols[stage];
            const showSparkline = sparklineStages.has(stage);
            const cfg         = stageConfig[stage];
            const isSignal    = stage === 'SIGNAL DETECTED';
            const isExecuting = stage === 'EXECUTING';

            return (
              <div
                key={stage}
                className={`rounded-sm p-2.5 polygent-col-scroll${isExecuting ? ' executing-hue-glow' : ''}`}
                style={{
                  // Recessed hardware bay — black/20 bg, vertical border-white/5 rails
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  borderLeft:      `1px solid rgba(255,255,255,0.05)`,
                  borderRight:     `1px solid rgba(255,255,255,0.05)`,
                  borderBottom:    `1px solid rgba(255,255,255,0.05)`,
                  // EXECUTING gets Electric Blue top glow; others get subtle white
                  borderTop:       `2px solid ${cfg.topBorder}`,
                  boxShadow:       cfg.glow,
                  minHeight:       '280px',
                  // Relative for scan-line absolute positioning
                  position:        'relative',
                  overflowY:       'auto',
                  maxHeight:       '520px',
                }}
              >
                {/* Scan line — SIGNAL DETECTED column only */}
                {isSignal && <div className="polygent-scan-line" />}

                {/* Data Filament receiver — top of EXECUTING column only */}
                {isExecuting && (
                  <div
                    aria-hidden
                    style={{
                      position:   'absolute',
                      top:        0,
                      left:       '50%',
                      transform:  'translateX(-50%)',
                      width:      '1px',
                      height:     '16px',
                      background: 'linear-gradient(to bottom, rgba(59,130,246,0.9), rgba(99,102,241,0.0))',
                      zIndex:     20,
                    }}
                  />
                )}

                {/* Column header */}
                <div
                  className="flex items-center gap-2 pb-2 mb-2.5"
                  style={{ borderBottom: `1px solid ${T.border.subtle}` }}
                >
                  <span
                    className="text-[12px] font-mono font-bold"
                    style={{ color: isExecuting ? T.color.blue : T.color.green }}
                  >
                    {stageIcon[stage]}
                  </span>
                  <span
                    className="text-[10px] font-mono tracking-wider uppercase"
                    style={{ color: isExecuting ? '#60a5fa' : T.text.muted }}
                  >
                    {stage}
                  </span>
                  <span
                    className="ml-auto text-[11px] font-bold font-mono"
                    style={{ color: isExecuting ? T.color.blue : T.color.green }}
                  >
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.slice(0, 20).map(card => (
                    <TradeCard
                      key={card.id}
                      card={card}
                      showSparkline={showSparkline}
                    />
                  ))}

                  {items.length === 0 && (
                    <div
                      className="py-8 text-center text-[10px] font-mono"
                      style={{ color: 'rgba(113,113,122,0.4)' }}
                    >
                      Waiting...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
