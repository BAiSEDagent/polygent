interface HeaderProps {
  wsConnected: boolean;
  marketsLoaded: number;
  agents: number;
}

export function Header({ wsConnected, marketsLoaded, agents }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-5 py-3"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        // Header sits on top of the global grid — keep transparent so grid shows through
        backgroundColor: 'rgba(5,5,5,0.85)',
      }}
    >
      {/* Left — brand */}
      <div>
        <h1 className="text-[15px] font-bold font-mono tracking-wide" style={{ color: '#f4f4f5' }}>
          POLYGENT <span style={{ color: '#71717a' }}>//</span> AGENT TRADING TERMINAL
        </h1>
        <p className="text-[11px] font-mono mt-0.5" style={{ color: '#71717a' }}>
          Polymarket Builder Stack · {marketsLoaded} markets · {agents} agents
        </p>
      </div>

      {/* Right — Neon Green LED status badges */}
      <div className="flex items-center gap-2.5">

        {/* LIVE SOCKET — solid neon green when connected, danger red when not */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-sm"
          style={
            wsConnected
              ? {
                  backgroundColor: '#22c55e',
                  color: '#000',
                  boxShadow: '0 0 10px rgba(34,197,94,0.5)',
                }
              : {
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(239,68,68,0.4)',
                }
          }
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
          style={{
            backgroundColor: '#22c55e',
            color: '#000',
            boxShadow: '0 0 10px rgba(34,197,94,0.5)',
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: '#000' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#000' }} />
          </span>
          GASLESS EXECUTION ACTIVE
        </div>

      </div>
    </header>
  );
}
