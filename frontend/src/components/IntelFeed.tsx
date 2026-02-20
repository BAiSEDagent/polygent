import { useEffect, useRef, useState } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

// ── Tag config ────────────────────────────────────────────────────────────────
const tagStyles: Record<string, { label: string; color: string }> = {
  signal:      { label: 'SIGNAL',  color: T.color.amber  },
  trade:       { label: 'TRADE',   color: T.color.green  },
  paper_trade: { label: 'PAPER',   color: T.color.blue   },
  execute:     { label: 'EXEC',    color: T.color.green  },
  fill:        { label: 'FILL',    color: T.color.green  },
  settle:      { label: 'SETTLE',  color: T.color.green  },
  close:       { label: 'CLOSE',   color: T.text.muted   },
  open:        { label: 'ALERT',   color: T.color.red    },
  error:       { label: 'ERROR',   color: T.color.red    },
};

function getTag(type: string) {
  return tagStyles[type] || { label: type?.toUpperCase() || 'INFO', color: T.text.muted };
}

function formatTs(ts: number): string {
  if (!ts) return '00:00:00';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
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
    case 'trade': case 'execute': case 'fill':
      return `${agent} ${side} ${amount} on "${market}"${price}`;
    case 'paper_trade':
      return `${agent} ${side} ${amount} on "${market}"${price}${event.reasoning ? ` — ${event.reasoning}` : ''}`;
    case 'settle': case 'close':
      return `${agent} closed ${amount} on "${market}"${pnl}`;
    case 'error':
      return `${agent} error on "${market}": execution failed`;
    default:
      return `${agent} ${side} ${amount} on "${market}"${price}`;
  }
}

// ── Hardware Readout Row ──────────────────────────────────────────────────────
function ReadoutRow({ label, value, valueColor }: {
  label: string;
  value: string | number | null | undefined;
  valueColor?: string;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="shrink-0 w-20 text-right"
        style={{ color: T.text.muted, fontSize: '9px', letterSpacing: '0.1em' }}
      >
        {label}
      </span>
      <span
        className="font-bold"
        style={{ color: valueColor || T.text.primary, fontSize: '11px' }}
      >
        {String(value)}
      </span>
    </div>
  );
}

// ── Expansion Panel — Hardware Readout ────────────────────────────────────────
function EventDetail({ event }: { event: any }) {
  const side     = event.side || 'BUY';
  const sideColor = side === 'SELL' ? T.color.red : T.color.green;
  const pnl      = event.pnl;
  const pnlColor  = pnl != null ? (pnl >= 0 ? T.color.green : T.color.red) : T.text.primary;
  // Left border color follows event sentiment
  const accentColor = event.type === 'signal'
    ? T.color.amber
    : event.type === 'error'
      ? T.color.red
      : side === 'SELL'
        ? T.color.red
        : T.color.green;

  return (
    <div
      className="mt-1.5 ml-[82px] font-mono"
      style={{
        // Recessed box with blueprint grid background
        backgroundColor: 'rgba(0,0,0,0.45)',
        backgroundImage: T.grid.imageSubtle,
        backgroundSize:  T.grid.size,
        borderLeft:      `2px solid ${accentColor}`,
        borderTop:       `1px solid ${T.border.subtle}`,
        borderBottom:    `1px solid ${T.border.subtle}`,
        borderRight:     `1px solid ${T.border.subtle}`,
        padding:         '8px 10px',
        borderRadius:    '0 2px 2px 0',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 mb-2 pb-1.5"
        style={{ borderBottom: `1px solid ${T.border.subtle}` }}
      >
        <span style={{ color: accentColor, fontSize: '9px', letterSpacing: '0.12em' }}>
          ◈ HARDWARE READ-OUT
        </span>
        <span style={{ color: T.text.dim, fontSize: '9px' }}>
          {formatTs(event.timestamp)}
        </span>
      </div>

      {/* Readout rows */}
      <div className="space-y-1">
        <ReadoutRow
          label="AGENT_ID"
          value={event.agentName || event.agentId}
          valueColor={T.color.blue}
        />
        <ReadoutRow
          label="TYPE"
          value={event.type?.toUpperCase()}
          valueColor={getTag(event.type).color}
        />
        {event.side && (
          <ReadoutRow label="SIDE" value={side} valueColor={sideColor} />
        )}
        <ReadoutRow
          label="MARKET"
          value={event.market}
          valueColor={T.text.primary}
        />
        {event.amount != null && (
          <ReadoutRow
            label="SIZE"
            value={formatAmount(event.amount)}
            valueColor={T.text.primary}
          />
        )}
        {event.price != null && (
          <ReadoutRow
            label="PRICE"
            value={`$${Number(event.price).toFixed(4)}`}
            valueColor={T.color.green}
          />
        )}
        {event.executedPrice != null && event.executedPrice !== event.price && (
          <ReadoutRow
            label="EXEC_PRICE"
            value={`$${Number(event.executedPrice).toFixed(4)}`}
            valueColor={T.color.green}
          />
        )}
        {event.outcome && (
          <ReadoutRow label="OUTCOME" value={event.outcome} valueColor={T.text.secondary} />
        )}
        {pnl != null && (
          <ReadoutRow
            label="PNL"
            value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`}
            valueColor={pnlColor}
          />
        )}
        {event.reasoning && (
          <div className="mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${T.border.subtle}` }}>
            <div style={{ color: T.text.muted, fontSize: '9px', letterSpacing: '0.1em', marginBottom: '3px' }}>
              REASONING
            </div>
            <div
              style={{
                color: T.text.secondary,
                fontSize: '10px',
                lineHeight: '1.5',
                wordBreak: 'break-word',
              }}
            >
              {event.reasoning}
            </div>
          </div>
        )}
        {event.id && (
          <ReadoutRow label="TX_ID" value={event.id} valueColor={T.text.dim} />
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function IntelFeed({ activities }: { activities: any[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activities.length]);

  return (
    <aside
      className="flex flex-col rounded-sm"
      style={{
        border:          `1px solid ${T.border.DEFAULT}`,
        backgroundColor: 'rgba(15,15,16,0.7)',
        maxHeight:       'calc(100vh - 120px)',
        overflow:        'hidden',
      }}
    >
      {/* Feed header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${T.border.DEFAULT}` }}
      >
        <h2
          className="text-[13px] font-bold font-mono tracking-wide"
          style={{ color: T.text.primary }}
        >
          INTEL FEED
        </h2>
        <span className="text-[10px] font-mono" style={{ color: T.text.muted }}>
          &gt; /mnt/polygent/feed.log
          <span className="animate-pulse" style={{ color: T.color.green }}>▋</span>
        </span>
      </div>

      {/* Scrollable log */}
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
          const tag      = getTag(event.type);
          const eventKey = event.id || String(i);
          const isExpanded = expandedId === eventKey;

          return (
            <div
              key={eventKey}
              className="mb-1.5 pb-1.5"
              style={{ borderBottom: `1px solid ${T.border.subtle}` }}
            >
              {/* Log line */}
              <div
                className="flex items-start flex-wrap gap-0 transition-colors cursor-default rounded-sm px-1"
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ color: T.text.dim, flexShrink: 0 }}>
                  [{formatTs(event.timestamp)}]
                </span>
                <span
                  className="font-bold ml-1 shrink-0"
                  style={{ color: tag.color }}
                >
                  &lt;{tag.label}&gt;
                </span>
                <span className="ml-1.5 break-words" style={{ color: T.text.secondary }}>
                  {formatLogLine(event)}
                </span>
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : eventKey)}
                className="text-[9px] mt-0.5 ml-[82px] transition-colors font-mono"
                style={{ color: 'rgba(113,113,122,0.4)' }}
                onMouseEnter={e => (e.currentTarget.style.color = T.color.green)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(113,113,122,0.4)')}
              >
                {isExpanded ? '▼ collapse' : '▶ details'}
              </button>

              {/* Hardware readout expansion */}
              {isExpanded && <EventDetail event={event} />}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
