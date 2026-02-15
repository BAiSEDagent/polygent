import { Link, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
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

const NAV = [
  { path: '/', label: 'Arena' },
  { path: '/markets', label: 'Markets' },
  { path: '/agents', label: 'Agents' },
  { path: '/connect', label: 'Connect' },
];

export default function Layout({ children, connected, stats }: Props) {
  const loc = useLocation();

  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-surface/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-mono text-base font-bold tracking-widest text-success">
            COGENT
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ path, label }) => {
              const active = path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`text-xs px-3 py-1.5 transition-colors ${
                    active
                      ? 'text-white border-b-2 border-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-5 text-xs font-mono">
          <Stat label="" value={`${stats.totalAgents} ACTIVE AGENTS`} />
          <Stat label="" value={`${formatUsd(stats.totalVolume)} TOTAL CAPITAL`} />
          <Stat label="" value={`${stats.marketsTracked} LIVE MARKETS`} />
          <span className={stats.platformPnl >= 0 ? 'text-success' : 'text-danger'}>
            {stats.platformPnl >= 0 ? '+' : ''}{formatUsd(stats.platformPnl)} PLATFORM P&L
          </span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success pulse-live' : 'bg-danger'}`} />
            <span className={connected ? 'text-success' : 'text-danger'}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-text-secondary">
      {label && <span className="text-text-muted mr-1">{label}</span>}
      {value}
    </span>
  );
}
