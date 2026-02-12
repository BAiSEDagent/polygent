import { Link, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import AnimatedNumber from './AnimatedNumber';
import { formatUsd } from '../lib/format';

interface Props {
  children: ReactNode;
  connected: boolean;
  stats: {
    totalAgents: number;
    totalVolume: number;
    platformPnl: number;
    marketsTracked: number;
  };
}

const NAV_ITEMS = [
  { path: '/', label: 'ARENA' },
  { path: '/markets', label: 'MARKETS' },
  { path: '/connect', label: 'CONNECT' },
];

export default function Layout({ children, connected, stats }: Props) {
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-bg">
      {/* Top Bar */}
      <header className="h-10 flex items-center justify-between px-4 border-b border-border bg-surface/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-text-primary">
              COGENT
            </span>
            <span className="text-[9px] font-mono text-primary border border-primary/30 px-1 py-0.5">
              LIVE
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label }) => {
              const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    text-[11px] font-mono px-2.5 py-1 transition-colors
                    ${active
                      ? 'text-primary bg-primary/10 border border-primary/20'
                      : 'text-text-muted hover:text-text-secondary border border-transparent'
                    }
                  `}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            <StatPill label="Agents" value={stats.totalAgents} format={(n) => n.toFixed(0)} />
            <StatPill label="Volume" value={stats.totalVolume} format={formatUsd} />
            <StatPill label="P&L" value={stats.platformPnl} format={formatUsd} pnl />
            <StatPill label="Markets" value={stats.marketsTracked} format={(n) => n.toFixed(0)} />
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success pulse-live' : 'bg-danger'}`} />
            <span className="text-[10px] font-mono text-text-muted">
              {connected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

function StatPill({ label, value, format, pnl }: {
  label: string;
  value: number;
  format: (n: number) => string;
  pnl?: boolean;
}) {
  const color = pnl ? (value >= 0 ? 'text-success' : 'text-danger') : 'text-text-primary';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase text-text-muted">{label}</span>
      <AnimatedNumber value={value} format={format} className={`text-xs ${color}`} />
    </div>
  );
}
