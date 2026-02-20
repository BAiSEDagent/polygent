import { useEffect, useRef, useState } from 'react';

const tagStyles: Record<string, { label: string; color: string }> = {
  signal:      { label: 'SIGNAL',  color: 'text-amber-400' },
  trade:       { label: 'TRADE',   color: 'text-emerald-400' },
  paper_trade: { label: 'PAPER',   color: 'text-blue-400' },
  execute:     { label: 'EXEC',    color: 'text-emerald-400' },
  fill:        { label: 'FILL',    color: 'text-emerald-400' },
  settle:      { label: 'SETTLE',  color: 'text-emerald-400' },
  close:       { label: 'CLOSE',   color: 'text-zinc-400' },
  open:        { label: 'ALERT',   color: 'text-red-400' },
  error:       { label: 'ERROR',   color: 'text-red-400' },
};

function getTag(type: string) {
  return tagStyles[type] || { label: type?.toUpperCase() || 'INFO', color: 'text-zinc-500' };
}

function formatTs(ts: number): string {
  if (!ts) return '00:00:00';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAmount(n: number): string {
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Parse event into a clean one-liner */
function formatLogLine(event: any): string {
  const agent = event.agentName || event.agentId || 'Agent';
  const side = event.side || 'BUY';
  const amount = event.amount ? formatAmount(event.amount) : '';
  const market = event.market || 'Unknown';
  const price = event.price ? ` @ $${event.price.toFixed(2)}` : '';
  const pnl = event.pnl != null ? ` → ${event.pnl >= 0 ? '+' : ''}${event.pnl.toFixed(2)}%` : '';

  switch (event.type) {
    case 'signal':
      return `${agent} detected opportunity on "${market}"`;
    case 'trade':
    case 'execute':
    case 'fill':
      return `${agent} ${side} ${amount} on "${market}"${price}`;
    case 'paper_trade':
      return `${agent} ${side} ${amount} on "${market}"${price}${event.reasoning ? ` — ${event.reasoning}` : ''}`;
    case 'settle':
    case 'close':
      return `${agent} closed ${amount} on "${market}"${pnl}`;
    case 'error':
      return `${agent} error on "${market}": execution failed`;
    default:
      return `${agent} ${side} ${amount} on "${market}"${price}`;
  }
}

export function IntelFeed({ activities }: { activities: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [activities.length]);

  return (
    <aside className="border border-border bg-surface/50 backdrop-blur-sm rounded-sm p-4 flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold tracking-wide text-header">INTEL FEED</h2>
        <span className="text-[10px] text-muted">
          &gt; /mnt/polygent/feed.log<span className="animate-pulse text-success">▋</span>
        </span>
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto bg-void/80 border border-border rounded-sm p-3 text-[11px] max-h-[calc(100vh-200px)]">
        {activities.length === 0 && (
          <div className="py-16 text-center text-muted/50">
            <p>[IDLE] No activity. Agents scanning markets...</p>
          </div>
        )}
        {activities.map((event, i) => {
          const tag = getTag(event.type);
          const logLine = formatLogLine(event);
          const isExpanded = expandedId === (event.id || String(i));

          return (
            <div
              key={event.id || i}
              className="mb-1.5 pb-1.5 border-b border-border/30 last:border-0 hover:bg-white/[0.02] transition-colors cursor-default"
            >
              <div className="flex items-start gap-0">
                <span className="text-muted shrink-0">[{formatTs(event.timestamp)}]</span>
                <span className={`${tag.color} font-bold shrink-0 ml-1`}>&lt;{tag.label}&gt;</span>
                <span className="text-slate-300 ml-1.5 break-words">{logLine}</span>
              </div>

              {/* Details toggle — raw data on demand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : (event.id || String(i)))}
                className="text-[9px] text-muted/40 hover:text-muted/70 mt-0.5 ml-[82px] transition-colors"
              >
                {isExpanded ? '▼ hide details' : '▶ details'}
              </button>

              {isExpanded && (
                <pre className="mt-1 ml-[82px] text-[9px] text-muted/30 bg-black/30 border border-border/30 rounded-sm p-2 overflow-x-auto">
                  {JSON.stringify({
                    agent: event.agentName || event.agentId,
                    type: event.type,
                    market: event.market,
                    side: event.side,
                    size: event.amount,
                    price: event.price,
                    pnl: event.pnl,
                    timestamp: event.timestamp,
                  }, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
