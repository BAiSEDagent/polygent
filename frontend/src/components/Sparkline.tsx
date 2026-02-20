/** Mini SVG sparkline for ops cards */
export function Sparkline({ positive = true, width = 140, height = 32 }: { positive?: boolean; width?: number; height?: number }) {
  // Generate a convincing price-action path (mocked sine + noise)
  const points = 20;
  const coords: string[] = [];
  const seed = Math.random() * 100;
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * width;
    const base = Math.sin((i + seed) * 0.6) * 8 + Math.sin((i + seed) * 1.4) * 4;
    const noise = (Math.random() - 0.5) * 6;
    const trend = positive ? (i / points) * 6 : -(i / points) * 6;
    const y = height / 2 - (base + noise + trend);
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const linePath = `M${coords.join(' L')}`;
  // Area fill: close path along bottom
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const stroke = positive ? '#10b981' : '#ef4444';
  const fillStart = positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)';
  const gradId = `spark-${positive ? 'g' : 'r'}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mt-1.5 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStart} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
