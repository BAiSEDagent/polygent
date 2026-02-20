/**
 * INDUSTRIAL_THEME — Polygent Mission Control Design System
 * Single source of truth for all UI colors and styles.
 * DO NOT use Tailwind semantic tokens for these values — they get JIT-purged.
 * Reference: WANT BACK STATE.jpg / ui-recovery-polygent branch
 */
export const INDUSTRIAL_THEME = {
  // ── Surfaces ───────────────────────────────────────────────────────────────
  bg: {
    void:    '#050505',   // global page background
    surface: '#0f0f10',   // card/panel backgrounds
    header:  'rgba(5,5,5,0.85)', // semi-transparent header over grid
    code:    '#020202',   // code editor / terminal backgrounds
  },

  // ── Blueprint grid (applied via backgroundImage) ───────────────────────────
  grid: {
    image:
      'linear-gradient(to right, rgba(100,116,139,0.1) 1px, transparent 1px), ' +
      'linear-gradient(to bottom, rgba(100,116,139,0.1) 1px, transparent 1px)',
    size: '24px 24px',
    imageSubtle:
      'linear-gradient(to right, rgba(100,116,139,0.18) 1px, transparent 1px), ' +
      'linear-gradient(to bottom, rgba(100,116,139,0.18) 1px, transparent 1px)',
  },

  // ── Text ───────────────────────────────────────────────────────────────────
  text: {
    primary:  '#f4f4f5',  // headings, high-contrast values
    secondary: '#cbd5e1', // body text
    muted:    '#71717a',  // labels, subtitles
    dim:      '#52525b',  // very muted (timestamps, footer)
  },

  // ── Accent colors ──────────────────────────────────────────────────────────
  color: {
    green:  '#22c55e',  // success, PnL+, LED active, DEPLOY, ONLINE
    blue:   '#3b82f6',  // primary CTA, COPY STRATEGY, orders
    red:    '#ef4444',  // danger, PnL-, drawdown
    amber:  '#f59e0b',  // warning, RISK logs, signals
    purple: '#8b5cf6',  // agent identity
  },

  // ── LED badge styles (LIVE SOCKET / GASLESS EXECUTION ACTIVE) ─────────────
  badge: {
    active: {
      backgroundColor: '#22c55e',
      color:           '#000',
      boxShadow:       '0 0 10px rgba(34,197,94,0.5)',
    },
    inactive: {
      backgroundColor: '#ef4444',
      color:           '#fff',
      boxShadow:       '0 0 10px rgba(239,68,68,0.4)',
    },
  },

  // ── Borders ────────────────────────────────────────────────────────────────
  border: {
    DEFAULT: 'rgba(255,255,255,0.08)',
    subtle:  'rgba(255,255,255,0.05)',
    strong:  'rgba(255,255,255,0.15)',
  },

  // ── Glow effects ───────────────────────────────────────────────────────────
  glow: {
    green: '0 0 18px rgba(34,197,94,0.4)',
    blue:  '0 0 18px rgba(59,130,246,0.45)',
  },
} as const;
