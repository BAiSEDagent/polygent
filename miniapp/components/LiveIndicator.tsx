'use client';

export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-pulse-live" />
      <span className="text-[var(--text-secondary)] uppercase tracking-wider">Live</span>
    </span>
  );
}
