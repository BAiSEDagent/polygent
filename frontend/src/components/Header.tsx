import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface HeaderProps {
  wsConnected: boolean;
  marketsLoaded: number;
  agents: number;
}

export function Header({ wsConnected, marketsLoaded, agents }: HeaderProps) {
  return (
    <>
      <style>{`
        /* CRT warm-up — fires once on mount */
        @keyframes crt-warmup {
          0%   { opacity:0; }
          15%  { opacity:0.9; }
          25%  { opacity:0.3; }
          35%  { opacity:1.0; }
          42%  { opacity:0.6; }
          50%  { opacity:1.0; }
          100% { opacity:1.0; }
        }
        .crt-title { animation: crt-warmup 0.55s ease-out forwards; }

        /* Badge heartbeat — 3s, synced with sentiment rails & energy bar */
        @keyframes badge-heartbeat {
          0%,100% { box-shadow: 0 0 4px rgba(34,197,94,0.3);  opacity: 0.82; }
          50%      { box-shadow: 0 0 14px rgba(34,197,94,0.9), 0 0 28px rgba(34,197,94,0.35); opacity: 1.0; }
        }
        .badge-live { animation: badge-heartbeat 3s ease-in-out infinite; }
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
          <h1
            className="text-[15px] font-bold font-mono tracking-wide"
            style={{
              color:      'rgba(244,244,245,0.88)',
              textShadow: '0 0 12px rgba(255,255,255,0.25),0 0 30px rgba(100,116,139,0.15)',
            }}
          >
            POLYGENT <span style={{ color: 'rgba(113,113,122,0.6)' }}>//</span> AGENT TRADING TERMINAL
          </h1>
          <p className="text-[11px] font-mono mt-0.5" style={{ color: T.text.muted, opacity: 0.2 }}>
            Polymarket Builder Stack · {marketsLoaded} markets · {agents} agents
          </p>
        </div>

        {/* Right — LED badges with 3s heartbeat breathing pulse */}
        <div className="flex items-center gap-2.5">

          {/* LIVE SOCKET */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-sm${wsConnected ? ' badge-live' : ''}`}
            style={wsConnected ? T.badge.active : T.badge.inactive}
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

          {/* GASLESS EXECUTION — always pulsing green */}
          <div
            className="badge-live flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-sm"
            style={T.badge.active}
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
