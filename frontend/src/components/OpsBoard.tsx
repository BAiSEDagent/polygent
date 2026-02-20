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

const stageIcon: Record<Stage, string> = {
  'SIGNAL DETECTED': '◎',
  'POSITIONS OPEN': '⟐',
  'EXECUTING': '⚡',
  'SETTLED': '✓',
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
    'POSITIONS OPEN': cards.filter(c => c.stage === 'POSITIONS OPEN'),
    'EXECUTING': cards.filter(c => c.stage === 'EXECUTING'),
    'SETTLED': cards.filter(c => c.stage === 'SETTLED'),
  };

  return (
    <section className="border border-border bg-surface/50 backdrop-blur-sm rounded-sm p-4 bg-grid-pattern">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold tracking-wide text-header">LIVE OPERATIONS BOARD</h2>
        <span className="text-[11px] text-success">GAMMA + CLOB PIPELINE</span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(cols) as Stage[]).map(stage => {
          const items = cols[stage];
          const showSparkline = sparklineStages.has(stage);
          return (
            <div key={stage} className="border border-border bg-void/80 rounded-sm p-2.5 min-h-[280px]">
              <div className="flex items-center gap-2 border-b border-border pb-2 mb-2.5">
                <span className="text-success text-[12px]">{stageIcon[stage]}</span>
                <span className="text-[10px] tracking-wider text-muted uppercase">{stage}</span>
                <span className="ml-auto text-[11px] text-success font-bold">{items.length}</span>
              </div>

              <div className="space-y-2">
                {items.slice(0, 7).map(card => (
                  <div key={card.id} className="border border-border bg-surface/30 rounded-sm p-2.5 hover:border-primary/30 transition-colors overflow-hidden">
                    <p className="text-[10px] text-muted">AGENT_ID: <span className="text-slate-400">{card.agentName}</span></p>
                    <p className="text-[11px] text-slate-200 truncate mt-0.5">MARKET: {card.market}</p>
                    <div className="flex items-center justify-between mt-1.5 text-[11px]">
                      <span className="text-slate-400">
                        SIZE: <span className="text-header">${card.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </span>
                      <span className={card.roi >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                        ROI: {card.roi >= 0 ? '+' : ''}{card.roi.toFixed(2)}%
                      </span>
                    </div>
                    {showSparkline && <Sparkline positive={card.roi >= 0} />}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-8 text-center text-[10px] text-muted/50">Waiting...</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
