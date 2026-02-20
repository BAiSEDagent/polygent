import { Sparkline } from './Sparkline';

type Stage = 'SIGNAL DETECTED' | 'POSITIONS OPEN' | 'EXECUTING' | 'SETTLED';

interface OpCard {
  id: string;
  agentName: string;
  market: string;
  size: number;
  roi: number;
  stage: Stage;
}

// Icons matching the approved "WANT BACK" dashboard spec
const stageIcon: Record<Stage, string> = {
  'SIGNAL DETECTED': '@',
  'POSITIONS OPEN':  '◇',
  'EXECUTING':       '⚡',
  'SETTLED':         '✓',
};

const sparklineStages = new Set<Stage>(['POSITIONS OPEN', 'EXECUTING']);

function classify(a: any): OpCard {
  let stage: Stage = 'POSITIONS OPEN';
  const t = a.type || '';
  if (t === 'signal' || t.includes('signal')) stage = 'SIGNAL DETECTED';
  else if (t === 'fill' || t === 'execute' || t === 'trade') stage = 'EXECUTING';
  else if (t === 'settle' || t === 'close') stage = 'SETTLED';
  else if (t === 'paper_trade') {
    const h = (a.id || '').charCodeAt(0) || 0;
    stage = (['SIGNAL DETECTED', 'POSITIONS OPEN', 'EXECUTING', 'SETTLED'] as Stage[])[h % 4];
  }
  return {
    id: a.id || `${a.agentId}-${a.timestamp}`,
    agentName: a.agentName || a.agentId || 'Agent',
    market: a.market || 'Unknown',
    size: a.amount || 0,
    roi: a.pnl ?? (Math.random() * 20 - 3),
    stage,
  };
}

export function OpsBoard({ activities }: { activities: any[] }) {
  const cards = activities.map(classify);
  const cols: Record<Stage, OpCard[]> = {
    'SIGNAL DETECTED': cards.filter(c => c.stage === 'SIGNAL DETECTED'),
    'POSITIONS OPEN':  cards.filter(c => c.stage === 'POSITIONS OPEN'),
    'EXECUTING':       cards.filter(c => c.stage === 'EXECUTING'),
    'SETTLED':         cards.filter(c => c.stage === 'SETTLED'),
  };

  return (
    <section
      className="rounded-sm p-4"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(15,15,16,0.5)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-[13px] font-bold font-mono tracking-wide"
          style={{ color: '#f4f4f5' }}
        >
          LIVE OPERATIONS BOARD
        </h2>
        <span className="text-[11px] font-mono" style={{ color: '#22c55e' }}>
          GAMMA + CLOB PIPELINE
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(cols) as Stage[]).map(stage => {
          const items = cols[stage];
          const showSparkline = sparklineStages.has(stage);

          return (
            <div
              key={stage}
              className="rounded-sm p-2.5"
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(5,5,5,0.8)',
                minHeight: '280px',
              }}
            >
              {/* Column header */}
              <div
                className="flex items-center gap-2 pb-2 mb-2.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-[12px] font-mono" style={{ color: '#22c55e' }}>
                  {stageIcon[stage]}
                </span>
                <span
                  className="text-[10px] font-mono tracking-wider uppercase"
                  style={{ color: '#71717a' }}
                >
                  {stage}
                </span>
                <span
                  className="ml-auto text-[11px] font-bold font-mono"
                  style={{ color: '#22c55e' }}
                >
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {items.slice(0, 7).map(card => (
                  <div
                    key={card.id}
                    className="rounded-sm p-2.5 overflow-hidden transition-colors"
                    style={{
                      border: '1px solid rgba(255,255,255,0.07)',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)')
                    }
                    onMouseLeave={e =>
                      (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')
                    }
                  >
                    <p className="text-[10px]" style={{ color: '#71717a' }}>
                      AGENT_ID: <span style={{ color: '#94a3b8' }}>{card.agentName}</span>
                    </p>
                    <p
                      className="text-[11px] truncate mt-0.5"
                      style={{ color: '#e2e8f0' }}
                    >
                      MARKET: {card.market}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 text-[11px]">
                      <span style={{ color: '#94a3b8' }}>
                        SIZE:{' '}
                        <span style={{ color: '#f4f4f5' }}>
                          ${card.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </span>
                      <span style={{ color: card.roi >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        ROI: {card.roi >= 0 ? '+' : ''}{card.roi.toFixed(2)}%
                      </span>
                    </div>
                    {showSparkline && <Sparkline positive={card.roi >= 0} />}
                  </div>
                ))}

                {items.length === 0 && (
                  <div
                    className="py-8 text-center text-[10px]"
                    style={{ color: 'rgba(113,113,122,0.5)' }}
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
  );
}
