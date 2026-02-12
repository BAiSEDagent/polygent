interface Level {
  price: number;
  size: number;
}

interface Props {
  bids: Level[];
  asks: Level[];
}

export default function OrderBook({ bids, asks }: Props) {
  const maxSize = Math.max(
    ...bids.map(l => l.size),
    ...asks.map(l => l.size),
    1
  );

  return (
    <div className="border border-border bg-surface">
      <div className="px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
          Order Book
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border text-[10px] font-mono">
        {/* Bids */}
        <div>
          <div className="grid grid-cols-2 px-2 py-1 text-text-muted border-b border-border/50">
            <span>Price</span>
            <span className="text-right">Size</span>
          </div>
          {bids.slice(0, 8).map((l, i) => (
            <div key={i} className="grid grid-cols-2 px-2 py-0.5 relative">
              <div
                className="absolute inset-0 bg-success/10"
                style={{ width: `${(l.size / maxSize) * 100}%` }}
              />
              <span className="relative text-success">{l.price.toFixed(4)}</span>
              <span className="relative text-right text-text-secondary">{l.size.toFixed(1)}</span>
            </div>
          ))}
        </div>
        {/* Asks */}
        <div>
          <div className="grid grid-cols-2 px-2 py-1 text-text-muted border-b border-border/50">
            <span>Price</span>
            <span className="text-right">Size</span>
          </div>
          {asks.slice(0, 8).map((l, i) => (
            <div key={i} className="grid grid-cols-2 px-2 py-0.5 relative">
              <div
                className="absolute inset-0 bg-danger/10 right-0 left-auto"
                style={{ width: `${(l.size / maxSize) * 100}%` }}
              />
              <span className="relative text-danger">{l.price.toFixed(4)}</span>
              <span className="relative text-right text-text-secondary">{l.size.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
