interface PositionsProps {
  positions: any[];
}

export function Positions({ positions }: PositionsProps) {
  if (positions.length === 0) {
    return null; // Don't show if no positions
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">Open Positions</h2>
      </div>
      <div className="p-6">
        <div className="text-zinc-500 text-sm text-center">
          Position tracking coming soon
        </div>
      </div>
    </div>
  );
}
