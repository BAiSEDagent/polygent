interface HeaderProps {
  wsConnected: boolean;
  marketsLoaded: number;
  agents: number;
}

export function Header({ wsConnected, marketsLoaded, agents }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-between border-b px-5 py-3"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#050505',
        backgroundImage:
          'linear-gradient(to right, rgba(100,116,139,0.12) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(100,116,139,0.12) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Left — brand */}
      <div>
        <h1 className="text-[15px] font-bold font-mono tracking-wide" style={{ color: '#f4f4f5' }}>
          POLYGENT <span style={{ color: '#71717a' }}>//</span> AGENT TRADING TERMINAL
        </h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#71717a' }}>
          Polymarket Builder Stack · {marketsLoaded} markets · {agents} agents
        </p>
      </div>

      {/* Right — status badges: plain bordered, no color theming */}
      <div className="flex items-center gap-2.5">
        {/* LIVE SOCKET — white bordered, shows connected state via text only */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-medium rounded-sm"
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#f4f4f5',
            background: 'transparent',
          }}
        >
          {wsConnected ? 'LIVE SOCKET' : 'DISCONNECTED'}
        </div>

        {/* GASLESS EXECUTION ACTIVE — plain bordered */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-medium rounded-sm"
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#f4f4f5',
            background: 'transparent',
          }}
        >
          GASLESS EXECUTION ACTIVE
        </div>
      </div>
    </header>
  );
}
