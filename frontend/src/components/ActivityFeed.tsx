const AGENT_COLORS: Record<string, string> = {
  'Arbitrage Scanner': 'text-blue-400',
  'Whale Tracker': 'text-emerald-400',
  'Contrarian': 'text-orange-400',
  'Sentiment': 'text-purple-400',
};

interface Activity {
  agentName: string;
  strategyName: string;
  type: string;
  data?: any;
  timestamp: number;
}

interface Props {
  activities: Activity[];
  highlightAgentId?: string;
}

export default function ActivityFeed({ activities }: Props) {
  return (
    <div className="h-full overflow-y-auto px-4 py-2 space-y-2">
      {activities.slice(-50).reverse().map((act, i) => {
        const time = new Date(act.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const color = AGENT_COLORS[act.agentName] || 'text-gray-400';
        const { label, detail, conf } = formatActivity(act);

        return (
          <div key={`${act.timestamp}-${i}`} className="text-sm">
            <span className="text-gray-600 font-mono text-xs mr-2">{timeStr}</span>
            <span className={`font-semibold ${color} mr-1`}>{act.agentName}</span>
            <span className="text-gray-300">{label}</span>
            {detail && <div className="ml-16 text-gray-500 text-xs mt-0.5">{detail}</div>}
            {conf !== null && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                {conf}%
              </span>
            )}
          </div>
        );
      })}
      {activities.length === 0 && (
        <div className="text-gray-600 text-sm text-center py-8">Waiting for agent activity...</div>
      )}
    </div>
  );
}

function formatActivity(act: Activity): { label: string; detail: string | null; conf: number | null } {
  const d = act.data || {};
  switch (act.type) {
    case 'signal':
      return {
        label: `Detected ${d.confidence ? (d.confidence * 100).toFixed(1) + '% ' : ''}signal`,
        detail: d.reasoning || d.marketId?.slice(0, 40),
        conf: d.confidence ? Math.round(d.confidence * 100) : null,
      };
    case 'trade':
      return {
        label: `${d.side} ${d.outcome} @ $${d.price?.toFixed(3) || '?'}`,
        detail: d.reasoning || d.marketId?.slice(0, 40),
        conf: null,
      };
    case 'circuit_break':
      return { label: '⚠️ Circuit breaker triggered', detail: `Drawdown: ${d.drawdown}`, conf: null };
    case 'error':
      return { label: 'Error', detail: d.error?.slice(0, 80), conf: null };
    default:
      return { label: act.type, detail: null, conf: null };
  }
}
