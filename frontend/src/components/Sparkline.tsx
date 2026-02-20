/** Mini SVG sparkline for ops cards */
import { useMemo } from 'react';

export function Sparkline({ positive = true, width = 140, height = 32 }: { positive?: boolean; width?: number; height?: number }) {
  // Stable memoised path — Math.random() seeded once, never re-run on re-render
  const { linePath, areaPath, gradId } = useMemo(() => {
    const points = 20;
    const coords: string[] = [];
    // Stable seed for this mount — never changes after first render
    const seed = Math.random() * 100;
    // Pre-generate noise values from seed so they are fixed for this sparkline instance
    const noiseValues = Array.from({ length: points + 1 }, (_, i) =>
      (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 6
    );
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * width;
      const base = Math.sin((i + seed) * 0.6) * 8 + Math.sin((i + seed) * 1.4) * 4;
      const noise = noiseValues[i];
      const trend = positive ? (i / points) * 6 : -(i / points) * 6;
      const y = height / 2 - (base + noise + trend);
      coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const lp = `M${coords.join(' L')}`;
    const ap = `${lp} L${width},${height} L0,${height} Z`;
    const gid = `spark-${positive ? 'g' : 'r'}-${Math.random().toString(36).slice(2, 6)}`;
    return { linePath: lp, areaPath: ap, gradId: gid };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positive, width, height]);

  const stroke = positive ? '#10b981' : '#ef4444';
  const fillStart = positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)';

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
