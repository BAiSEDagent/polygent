import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HealthStatus } from '../components/dashboard/HealthStatus';
import { TrustScore } from '../components/dashboard/TrustScore';
import { PnLChart } from '../components/dashboard/PnLChart';
import { TradeHistory } from '../components/dashboard/TradeHistory';
import { Positions } from '../components/dashboard/Positions';
import { api } from '../lib/api';

interface DashboardData {
  agent: {
    id: string;
    name: string;
    description?: string;
    strategy?: string;
    status: string;
    createdAt: number;
    lastActivity: number;
  };
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
  pnl: {
    deposited: number;
    currentEquity: number;
    totalPnL: number;
    totalPnLPct: number;
    realizedPnL: number;
    unrealizedPnL: number;
  };
  performance: {
    totalTrades: number;
    filledTrades: number;
    winRate: number;
    avgTradeSize: number;
    peakEquity: number;
    maxDrawdown: number;
  };
  trades: any[];
  positions: any[];
  trustScore: {
    score: number;
    attestationCount: number;
    lastUpdate: number | null;
    verified: boolean;
  };
}

export function SovereignDashboard() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/${agentId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Agent not found');
          }
          throw new Error('Failed to load dashboard');
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10_000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [agentId, navigate]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 font-mono text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400 font-mono text-sm">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
                >
                  ← Back
                </button>
                <h1 className="text-xl font-semibold text-zinc-100">{data.agent.name}</h1>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    data.agent.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {data.agent.status}
                </span>
              </div>
              {data.agent.strategy && (
                <p className="text-zinc-500 text-sm mt-1">{data.agent.strategy}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                <span className={data.pnl.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  ${data.pnl.totalPnL.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                {data.pnl.totalPnLPct >= 0 ? '+' : ''}
                {data.pnl.totalPnLPct.toFixed(2)}% P&L
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Row: Health + Trust Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HealthStatus health={data.health} />
          </div>
          <div>
            <TrustScore score={data.trustScore} />
          </div>
        </div>

        {/* P&L Chart */}
        <PnLChart pnl={data.pnl} trades={data.trades} />

        {/* Positions (if any) */}
        {data.positions.length > 0 && <Positions positions={data.positions} />}

        {/* Trade History */}
        <TradeHistory trades={data.trades} />
      </div>
    </div>
  );
}
