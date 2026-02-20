import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface HeaderProps {
  wsConnected: boolean;
  marketsLoaded: number;
  agents: number;
}

export function Header({ wsConnected, marketsLoaded, agents }: HeaderProps) {
  const activeBadge = T.badge.active;
  const socketBadge = wsConnected ? T.badge.active : T.badge.inactive;

  return (
    <header
      className="flex items-center justify-between px-5 py-3"
      style={{
        borderBottom: `1px solid ${T.border.DEFAULT}`,
        backgroundColor: T.bg.header,
      }}
    >
      {/* Left — brand */}
      <div>
        <h1 className="text-[15px] font-bold font-mono tracking-wide" style={{ color: T.text.primary }}>
          POLYGENT <span style={{ color: T.text.muted }}>//</span> AGENT TRADING TERMINAL
        </h1>
        <p className="text-[11px] font-mono mt-0.5" style={{ color: T.text.muted }}>
          Polymarket Builder Stack · {marketsLoaded} markets · {agents} agents
        </p>
      </div>

      {/* Right — Neon Green LED status badges */}
      <div className="flex items-center gap-2.5">

        {/* LIVE SOCKET — solid LED green / red */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-sm"
          style={socketBadge}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ backgroundColor: wsConnected ? '#000' : '#fff' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: wsConnected ? '#000' : '#fff' }}
            />
          </span>
          {wsConnected ? 'LIVE SOCKET' : 'DISCONNECTED'}
        </div>

        {/* GASLESS EXECUTION — always solid neon green */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-sm"
          style={activeBadge}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ backgroundColor: '#000' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: '#000' }}
            />
          </span>
          GASLESS EXECUTION ACTIVE
        </div>

      </div>
    </header>
  );
}
