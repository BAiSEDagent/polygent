import { NavLink, Outlet } from 'react-router-dom';
import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';

const navItems = [
  { to: '/', label: 'Arena' },
  { to: '/markets', label: 'Markets' },
  { to: '/agents', label: 'Agents' },
  { to: '/connect', label: 'Connect' },
];

export default function Layout() {
  const healthFetcher = useCallback(() => api.getHealth(), []);
  const { data: health } = useApi(healthFetcher, 5000);

  const agents = (health as any)?.agents ?? 0;
  const markets = (health as any)?.liveData?.marketsTracked ?? 0;

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <header className="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-mono font-bold text-emerald-400 text-lg tracking-widest">COGENT</span>
          <nav className="flex gap-4">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white border-b-2 border-white pb-0.5'
                      : 'text-gray-500 hover:text-gray-300'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <Stat value={agents} label="ACTIVE AGENTS" />
          <Stat value="$40,000" label="TOTAL CAPITAL" />
          <Stat value={markets} label="LIVE MARKETS" />
          <Stat value="+$253.60" label="PLATFORM P&L" color="text-emerald-400" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold">LIVE</span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono font-semibold ${color || 'text-white'}`}>{value}</div>
      <div className="text-gray-600 text-[10px]">{label}</div>
    </div>
  );
}
