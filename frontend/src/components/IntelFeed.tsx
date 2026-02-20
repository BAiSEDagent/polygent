import { useEffect, useRef, useState } from 'react';

const tagStyles: Record<string, { label: string; color: string }> = {
  signal:      { label: 'SIGNAL',  color: '#f59e0b' },   // amber
  trade:       { label: 'TRADE',   color: '#22c55e' },   // green
  paper_trade: { label: 'PAPER',   color: '#3b82f6' },   // blue
  execute:     { label: 'EXEC',    color: '#22c55e' },
  fill:        { label: 'FILL',    color: '#22c55e' },
  settle:      { label: 'SETTLE',  color: '#22c55e' },
  close:       { label: 'CLOSE',   color: '#71717a' },
  open:        { label: 'ALERT',   color: '#ef4444' },
  error:       { label: 'ERROR',   color: '#ef4444' },
};

function getTag(type: string) {
  return tagStyles[type] || { label: type?.toUpperCase() || 'INFO', color: '#71717a' };
}

function formatTs(ts: number): string {
  if (!ts) return '00:00:00';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAmount(n: number): string {
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatLogLine(event: any): string {
  const agent  = event.agentName || event.agentId || 'Agent';
  const side   = event.side || 'BUY';
  const amount = event.amount ? formatAmount(event.amount) : '';
  const market = event.market || 'Unknown';
  const price  = event.price  ? ` @ $${event.price.toFixed(2)}` : '';
  const pnl    = event.pnl != null ? ` → ${event.pnl >= 0 ? '+' : ''}${event.pnl.toFixed(2)}%` : '';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auto-scroll to top on new activity
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activities.length]);

  return (
    // Sticky column — stays in viewport while left column scrolls past
    <aside
      className="flex flex-col rounded-sm"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(15,15,16,0.7)',
        // Constrain height to viewport so it scrolls independently
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-[13px] font-bold font-mono tracking-wide" style={{ color: '#f4f4f5' }}>
          INTEL FEED
        </h2>
        <span className="text-[10px] font-mono" style={{ color: '#71717a' }}>
          &gt; /mnt/polygent/feed.log
          <span className="animate-pulse" style={{ color: '#22c55e' }}>▋</span>
        </span>
      </div>

      {/* Scrollable log area — fills remaining height */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 text-[11px] font-mono"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {activities.length === 0 && (
          <div className="py-16 text-center" style={{ color: 'rgba(113,113,122,0.5)' }}>
            [IDLE] No activity. Agents scanning markets...
          </div>
        )}

        {activities.map((event, i) => {
          const tag       = getTag(event.type);
          const logLine   = formatLogLine(event);
          const eventKey  = event.id || String(i);
          const isExpanded = expandedId === eventKey;

          return (
            <div
              key={eventKey}
              className="mb-1.5 pb-1.5 transition-colors cursor-default"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div className="flex items-start gap-0 flex-wrap">
                <span style={{ color: '#71717a', flexShrink: 0 }}>
                  [{formatTs(event.timestamp)}]
                </span>
                <span
                  className="font-bold ml-1"
                  style={{ color: tag.color, flexShrink: 0 }}
                >
                  &lt;{tag.label}&gt;
                </span>
                <span className="ml-1.5 break-words" style={{ color: '#cbd5e1' }}>
                  {logLine}
                </span>
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : eventKey)}
                className="text-[9px] mt-0.5 ml-[82px] transition-colors"
                style={{ color: 'rgba(113,113,122,0.4)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(113,113,122,0.7)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(113,113,122,0.4)')}
              >
                {isExpanded ? '▼ hide details' : '▶ details'}
              </button>

              {isExpanded && (
                <pre
                  className="mt-1 ml-[82px] text-[9px] rounded-sm p-2 overflow-x-auto"
                  style={{
                    color: 'rgba(113,113,122,0.6)',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {JSON.stringify({
                    agent:     event.agentName || event.agentId,
                    type:      event.type,
                    market:    event.market,
                    side:      event.side,
                    size:      event.amount,
                    price:     event.price,
                    pnl:       event.pnl,
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
