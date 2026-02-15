import { NavLink, Outlet } from 'react-router-dom';
import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../lib/api';

function fmt(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function Layout() {
  const healthFetcher = useCallback(() => api.getHealth(), []);
  const { data: health } = useApi(healthFetcher, 5000);
  const { connected } = useWebSocket();

  const agents = health?.agents ?? 0;
  const markets = health?.liveData?.marketCount ?? 0;

  const navLinks = [
    { to: '/', label: 'Arena' },
    { to: '/markets', label: 'Markets' },
    { to: '/agents', label: 'Agents' },
    { to: '/connect', label: 'Connect' },
  ];

  return (
    <>
      {/* Top Bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-mono font-bold text-accent-green text-lg tracking-widest">COGENT</span>
          <nav className="flex gap-4">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? 'text-white border-b-2 border-white pb-0.5' : 'text-gray-500 hover:text-gray-300'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <Stat value={agents} label="ACTIVE AGENTS" />
          <Stat value={fmt(40000)} label="TOTAL CAPITAL" raw />
          <Stat value={markets} label="LIVE MARKETS" />
          <Stat value="+$253.60" label="PLATFORM P&L" raw color="text-accent-green" />
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green animate-pulse' : 'bg-red-500'}`} />
            <span className={`font-mono font-semibold ${connected ? 'text-accent-green' : 'text-red-500'}`}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </>
  );
}

function Stat({ value, label, raw, color }: { value: any; label: string; raw?: boolean; color?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-mono font-bold ${color ?? 'text-white'}`}>{raw ? value : value}</span>
      <span className="text-gray-600 tracking-wider">{label}</span>
    </div>
  );
}
