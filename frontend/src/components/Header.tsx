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
    <>
      {/* CRT warm-up flicker + title glow keyframes */}
      <style>{`
        @keyframes crt-warmup {
          0%   { opacity: 0; }
          15%  { opacity: 0.9; }
          25%  { opacity: 0.3; }
          35%  { opacity: 1.0; }
          42%  { opacity: 0.6; }
          50%  { opacity: 1.0; }
          100% { opacity: 1.0; }
        }
        .crt-title {
          animation: crt-warmup 0.55s ease-out forwards;
        }
        @keyframes energy-bar-pulse {
          0%, 100% { opacity: 0.35; box-shadow: 0 0 4px rgba(59,130,246,0.4); }
          50%       { opacity: 1.0;  box-shadow: 0 0 10px rgba(59,130,246,0.9), 0 0 20px rgba(59,130,246,0.4); }
        }
        .energy-bar {
          animation: energy-bar-pulse 3s ease-in-out infinite;
        }
      `}</style>

      <header
        className="flex items-center justify-between px-5 py-3"
        style={{
          borderBottom:    `1px solid ${T.border.DEFAULT}`,
          backgroundColor: T.bg.header,
        }}
      >
        {/* Left — CRT-etched brand */}
        <div className="crt-title">
          {/* Main title — glass etch with projected glow */}
          <h1
            className="text-[15px] font-bold font-mono tracking-wide"
            style={{
              color:      'rgba(244,244,245,0.88)',
              textShadow:
                '0 0 12px rgba(255,255,255,0.25), ' +
                '0 0 30px rgba(100,116,139,0.15)',
            }}
          >
            POLYGENT{' '}
            <span style={{ color: 'rgba(113,113,122,0.6)' }}>//</span>{' '}
            AGENT TRADING TERMINAL
          </h1>

          {/* Subtitle — metadata etched into glass, 20% opacity */}
          <p
            className="text-[11px] font-mono mt-0.5"
            style={{ color: T.text.muted, opacity: 0.2 }}
          >
            Polymarket Builder Stack · {marketsLoaded} markets · {agents} agents
          </p>
        </div>

        {/* Right — LED status badges */}
        <div className="flex items-center gap-2.5">

          {/* LIVE SOCKET */}
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

          {/* GASLESS EXECUTION */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-sm"
            style={activeBadge}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: '#000' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#000' }} />
            </span>
            GASLESS EXECUTION ACTIVE
          </div>

        </div>
      </header>
    </>
  );
}
