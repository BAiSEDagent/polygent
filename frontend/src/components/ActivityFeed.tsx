import { motion, AnimatePresence } from 'framer-motion';
import { AgentActivity } from '../lib/types';
import { timeAgo, truncate, formatPrice } from '../lib/format';

interface Props {
  activities: AgentActivity[];
  highlightAgentId?: string;
}

function getActionText(a: AgentActivity): string {
  if (a.type === 'trade' && a.data) {
    return `${a.data.side} ${a.data.outcome}`;
  }
  if (a.type === 'signal' && a.data) {
    return `SIGNAL ${a.data.direction} ${a.data.outcome}`;
  }
  if (a.type === 'circuit_break') return 'CIRCUIT BREAK';
  if (a.type === 'error') return 'ERROR';
  return a.type.toUpperCase();
}

function getActionColor(a: AgentActivity): string {
  if (a.type === 'trade') {
    return a.data?.side === 'BUY' ? 'text-primary' : 'text-amber-400';
  }
  if (a.type === 'signal') return 'text-accent';
  if (a.type === 'circuit_break') return 'text-danger';
  if (a.type === 'error') return 'text-danger';
  return 'text-text-muted';
}

export default function ActivityFeed({ activities, highlightAgentId }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Live Activity
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-success rounded-full pulse-live" />
          <span className="text-[10px] font-mono text-text-muted">LIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {activities.map((a, i) => {
            const isHighlighted = highlightAgentId && a.agentId === highlightAgentId;
            return (
              <motion.div
                key={`${a.timestamp}-${i}`}
                initial={{ opacity: 0, x: 30, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`
                  px-3 py-2 border-b border-border/30
                  ${isHighlighted ? 'bg-primary/8' : ''}
                `}
              >
                <div className="flex items-start gap-2">
                  {/* Timestamp */}
                  <span className="text-[10px] font-mono text-text-muted whitespace-nowrap mt-0.5">
                    {timeAgo(a.timestamp)}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Agent + Action */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-text-primary">
                        {a.agentName}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold ${getActionColor(a)}`}>
                        {getActionText(a)}
                      </span>
                      {a.data?.price && (
                        <span className="text-[10px] font-mono text-text-secondary">
                          @ {formatPrice(a.data.price)}
                        </span>
                      )}
                      {a.data?.amount && (
                        <span className="text-[10px] font-mono text-text-muted">
                          ×{a.data.amount.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Reasoning / Market */}
                    {a.data?.reasoning && (
                      <p className="text-[10px] text-text-muted mt-0.5 leading-tight">
                        {truncate(a.data.reasoning, 120)}
                      </p>
                    )}
                    {a.data?.marketId && (
                      <p className="text-[10px] font-mono text-text-muted/60 mt-0.5">
                        {truncate(a.data.marketId, 40)}
                      </p>
                    )}

                    {/* Confidence */}
                    {a.data?.confidence != null && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1 flex-1 bg-border max-w-[80px]">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${a.data.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-text-muted">
                          {(a.data.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {activities.length === 0 && (
          <div className="p-8 text-center text-text-muted text-xs font-mono">
            Waiting for agent activity...
          </div>
        )}
      </div>
    </div>
  );
}
