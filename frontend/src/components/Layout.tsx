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
  const lbFetcher = useCallback(() => api.getLeaderboard(), []);
  const { data: health } = useApi(healthFetcher, 5000);
  const { data: lb } = useApi(lbFetcher, 5000);

  const agents = health?.agents ?? 0;
  const markets = health?.liveData?.marketsLoaded ?? health?.liveData?.marketsTracked ?? 0;

  const leaderboard = lb?.leaderboard ?? [];
  const totalEquity = leaderboard.reduce((s: number, a: any) => s + (a.currentEquity ?? 0), 0);
  const totalDeposited = leaderboard.reduce((s: number, a: any) => s + (a.depositedEquity ?? 0), 0);
  const platformPnl = totalEquity - totalDeposited;
  const pnlStr = `${platformPnl >= 0 ? '+' : ''}$${Math.abs(platformPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0B0E' }}>
      {/* Top Bar */}
      <header className="h-12 flex items-center justify-between px-5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-8">
          <span className="font-mono font-bold text-emerald-400 text-lg tracking-[0.25em]">POLYGENT</span>
          <nav className="flex gap-5">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors pb-0.5 ${
                    isActive
                      ? 'text-white border-b-2 border-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-8 text-xs">
          <StatBlock value={agents} label="ACTIVE AGENTS" />
          <StatBlock value={`$${totalDeposited.toLocaleString()}`} label="TOTAL CAPITAL" />
          <StatBlock value={markets} label="LIVE MARKETS" />
          <StatBlock value={pnlStr} label="PLATFORM P&L" color={platformPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold tracking-wide">LIVE</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function StatBlock({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono font-bold text-sm ${color || 'text-white'}`}>{value}</div>
      <div className="text-gray-600 text-[10px] tracking-wider">{label}</div>
    </div>
  );
}
