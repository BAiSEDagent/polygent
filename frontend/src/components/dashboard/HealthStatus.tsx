import { AlertTriangle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface HealthStatusProps {
  health: {
    healthy: boolean;
    wallet: string;
    balances: {
      usdce: string;
      pol: string;
    };
    approvals: {
      usdceToExchange: boolean;
      ctfToExchange: boolean;
    };
    status: {
      circuitBreaker: boolean;
      agentActive: boolean;
    };
    blockers: string[];
    lastTrade?: number;
  };
}

export function HealthStatus({ health }: HealthStatusProps) {
  const statusColor = health.healthy
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : health.blockers.length > 0
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';

  const statusIcon = health.healthy ? (
    <CheckCircle2 className="w-5 h-5" />
  ) : (
    <XCircle className="w-5 h-5" />
  );

  const statusText = health.healthy
    ? 'Healthy — Ready to Trade'
    : `${health.blockers.length} Blocker${health.blockers.length === 1 ? '' : 's'}`;

  // Parse wallet address for Polygonscan link
  const polygonscanUrl = `https://polygonscan.com/address/${health.wallet}`;

  // Action button helpers
  const getFundAction = () => {
    if (health.blockers.some(b => b.includes('USDC.e balance'))) {
      return {
        label: 'Fund Wallet',
        href: polygonscanUrl,
        variant: 'primary' as const,
      };
    }
    return null;
  };

  const getApprovalAction = () => {
    if (health.blockers.some(b => b.includes('approval'))) {
      return {
        label: 'Set Approvals',
        href: '/api/agents/onboard', // Placeholder — real implementation needs onboarding flow
        variant: 'secondary' as const,
      };
    }
    return null;
  };

  const fundAction = getFundAction();
  const approvalAction = getApprovalAction();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Health Status</h2>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusColor}`}>
          {statusIcon}
          <span className="text-sm font-medium">{statusText}</span>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">USDC.e Balance</div>
          <div className="text-lg font-semibold text-zinc-100">{health.balances.usdce}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">POL (Gas)</div>
          <div className="text-lg font-semibold text-zinc-100">{health.balances.pol}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">USDC → Exchange</div>
          <div className={`text-sm font-medium ${health.approvals.usdceToExchange ? 'text-emerald-400' : 'text-red-400'}`}>
            {health.approvals.usdceToExchange ? '✓ Approved' : '✗ Missing'}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">CTF → Exchange</div>
          <div className={`text-sm font-medium ${health.approvals.ctfToExchange ? 'text-emerald-400' : 'text-red-400'}`}>
            {health.approvals.ctfToExchange ? '✓ Approved' : '✗ Missing'}
          </div>
        </div>
      </div>

      {/* Blockers */}
      {health.blockers.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Blockers</div>
          {health.blockers.map((blocker, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm text-zinc-300 leading-relaxed">{blocker}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(fundAction || approvalAction) && (
        <div className="flex gap-3">
          {fundAction && (
            <a
              href={fundAction.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                fundAction.variant === 'primary'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
            >
              {fundAction.label}
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {approvalAction && (
            <a
              href={approvalAction.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                approvalAction.variant === 'primary'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
            >
              {approvalAction.label}
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Wallet Link */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <a
          href={polygonscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          <span className="font-mono">{health.wallet.slice(0, 6)}...{health.wallet.slice(-4)}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
