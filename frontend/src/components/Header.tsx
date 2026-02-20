interface HeaderProps {
  wsConnected: boolean;
  marketsLoaded: number;
  agents: number;
}

export function Header({ wsConnected, marketsLoaded, agents }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface/80 backdrop-blur-md px-5 py-3 bg-grid-pattern">
      <div>
        <h1 className="text-[15px] font-bold tracking-wide text-header">
          POLYGENT <span className="text-muted">//</span> AGENT TRADING TERMINAL
        </h1>
        <p className="text-[11px] text-muted mt-0.5">
          Polymarket Builder Stack · {marketsLoaded} markets · {agents} agents
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <div className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-medium rounded-sm ${
          wsConnected
            ? 'border-success/30 text-success bg-success/5'
            : 'border-danger/30 text-danger bg-danger/5'
        }`}>
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${wsConnected ? 'bg-success animate-ping' : 'bg-danger'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-success' : 'bg-danger'}`} />
          </span>
          {wsConnected ? 'LIVE SOCKET' : 'DISCONNECTED'}
        </div>
        <div className="flex items-center gap-1.5 border border-success/30 bg-success/5 px-2.5 py-1.5 text-[11px] font-medium text-success rounded-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          GASLESS EXECUTION ACTIVE
        </div>
      </div>
    </header>
  );
}
