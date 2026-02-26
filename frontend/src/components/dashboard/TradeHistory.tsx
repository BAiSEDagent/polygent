import { ExternalLink } from 'lucide-react';

interface TradeHistoryProps {
  trades: Array<{
    id: string;
    timestamp: number;
    marketId: string;
    side: 'BUY' | 'SELL';
    outcome: string;
    amount: number;
    price: number;
    notional: number;
    status: string;
    orderId?: string;
  }>;
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
        <div className="text-zinc-500 text-sm">No trades yet</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">Trade History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
              <th className="px-6 py-3 text-left font-medium">Time</th>
              <th className="px-6 py-3 text-left font-medium">Market</th>
              <th className="px-6 py-3 text-left font-medium">Side</th>
              <th className="px-6 py-3 text-left font-medium">Outcome</th>
              <th className="px-6 py-3 text-right font-medium">Amount</th>
              <th className="px-6 py-3 text-right font-medium">Price</th>
              <th className="px-6 py-3 text-right font-medium">Notional</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {trades.map((trade) => {
              const polymarketUrl = `https://polymarket.com/event/${trade.marketId}`;
              return (
                <tr key={trade.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                    {new Date(trade.timestamp * 1000).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                    {trade.marketId.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        trade.side === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-300 max-w-[200px] truncate">
                    {trade.outcome}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-100 text-right font-mono">
                    {trade.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-100 text-right font-mono">
                    ${trade.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-100 text-right font-mono">
                    ${trade.notional.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        trade.status === 'filled'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={polymarketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
