import { timeAgo } from '../lib/format';

interface Activity {
  agentId: string;
  agentName: string;
  strategyName: string;
  type: string;
  data?: {
    marketId?: string;
    direction?: string;
    outcome?: string;
    confidence?: number;
    reasoning?: string;
    side?: string;
    price?: number;
    amount?: number;
    error?: string;
  };
  timestamp: number;
}

const AGENT_COLORS: Record<string, string> = {};
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
let colorIdx = 0;
function getAgentColor(name: string): string {
  if (!AGENT_COLORS[name]) {
    AGENT_COLORS[name] = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;
  }
  return AGENT_COLORS[name];
}

interface Props {
  activities: Activity[];
  highlightAgentId?: string;
}

export default function ActivityFeed({ activities }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {activities.slice(0, 30).map((a, i) => {
        const color = getAgentColor(a.agentName);
        const actionText = a.type === 'trade'
          ? `${a.data?.side ?? 'BUY'} ${a.data?.outcome ?? ''}`
          : a.type === 'signal'
          ? `Signal: ${a.data?.direction ?? ''} ${a.data?.outcome ?? ''}`
          : a.type === 'error'
          ? 'Error'
          : a.type;

        return (
          <div key={`${a.timestamp}-${i}`} className="flex items-start gap-3 px-4 py-2 border-b border-border/50 text-xs">
            <span className="text-text-muted font-mono shrink-0 w-12 tabular-nums">
              {timeAgo(a.timestamp)}
            </span>
            <span className="font-semibold shrink-0" style={{ color }}>{a.agentName}</span>
            <span className="text-text-secondary">{actionText}</span>
            {a.data?.reasoning && (
              <span className="text-text-muted truncate flex-1">{a.data.reasoning}</span>
            )}
            {a.data?.confidence != null && (
              <span className="shrink-0 bg-success/20 text-success text-[10px] font-mono px-1.5 py-0.5 rounded-full">
                {(a.data.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
      {activities.length === 0 && (
        <div className="p-4 text-text-muted text-xs text-center">No activity yet</div>
      )}
    </div>
  );
}
