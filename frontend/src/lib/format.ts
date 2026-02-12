export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  const prefix = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}$${abs.toFixed(2)}`;
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatPrice(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
