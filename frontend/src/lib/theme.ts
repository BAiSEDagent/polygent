/**
 * INDUSTRIAL_THEME — Polygent Mission Control Design System
 * Single source of truth for all UI colors, styles, and animation tokens.
 * DO NOT use Tailwind semantic tokens — they get JIT-purged at build time.
 *
 * Reference: WANT BACK STATE.jpg / ui-recovery-polygent branch
 * CSS classes: frontend/src/styles/industrial.css (global keyframes + utilities)
 * Last hardened: 2026-02-19 — Build 71429ca
 */
export const INDUSTRIAL_THEME = {
  // ── Surfaces ───────────────────────────────────────────────────────────────
  bg: {
    void:    '#050505',          // global page background
    surface: '#0f0f10',          // card/panel backgrounds
    header:  'rgba(5,5,5,0.85)', // semi-transparent header over grid
    code:    '#020202',          // code editor / terminal backgrounds
    glass:   'rgba(0,0,0,0.60)', // smoked glass panels (OpsBoard cards)
    glassHeavy: 'rgba(0,0,0,0.92)', // heavy mute (Leaderboard rows)
    obsidian: 'rgba(3,3,3,0.95)', // near-solid mute (Leaderboard section)
  },

  // ── Blueprint grid (applied via backgroundImage inline style) ──────────────
  // ALWAYS use these values — never hardcode rgba(100,116,139,X) elsewhere
  grid: {
    image:
      'linear-gradient(to right, rgba(100,116,139,0.03) 1px, transparent 1px), ' +
      'linear-gradient(to bottom, rgba(100,116,139,0.03) 1px, transparent 1px)',
    size: '24px 24px',
    imageSubtle:
      'linear-gradient(to right, rgba(100,116,139,0.025) 1px, transparent 1px), ' +
      'linear-gradient(to bottom, rgba(100,116,139,0.025) 1px, transparent 1px)',
  },

  // ── Text ───────────────────────────────────────────────────────────────────
  text: {
    primary:   '#f4f4f5',  // headings, high-contrast values
    secondary: '#cbd5e1',  // body text
    muted:     '#71717a',  // labels, subtitles
    dim:       '#52525b',  // very muted (timestamps, footer)
  },

  // ── Accent colors ──────────────────────────────────────────────────────────
  color: {
    green:  '#22c55e',  // success, PnL+, LED active, DEPLOY, ONLINE
    blue:   '#3b82f6',  // primary CTA, COPY STRATEGY, Electric Blue Energy Bar
    red:    '#ef4444',  // danger, PnL-, drawdown
    amber:  '#f59e0b',  // warning, RISK logs, signals
    purple: '#a855f7',  // OperatorBridge auth gate, cursor pulse
    gold:   '#fbbf24',  // #1 rank leaderboard glow
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
    dashed:  'rgba(255,255,255,0.20)',  // watch-only input slot
  },

  // ── Glow effects ───────────────────────────────────────────────────────────
  glow: {
    green:  '0 0 18px rgba(34,197,94,0.4)',
    blue:   '0 0 18px rgba(59,130,246,0.45)',
    purple: '0 0 18px rgba(168,85,247,0.4)',
    gold:   '0 0 8px #fbbf24, 0 0 20px rgba(251,191,36,0.75), 0 0 48px rgba(217,119,6,0.40)',
  },

  // ── Smoked glass surfaces ──────────────────────────────────────────────────
  // Spread into inline style props: style={{ ...T.glass.panel, border: ... }}
  glass: {
    panel: {
      backgroundColor:      'rgba(0,0,0,0.60)',
      backdropFilter:       'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    },
    heavy: {
      backgroundColor:      'rgba(0,0,0,0.82)',
      backdropFilter:       'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    },
    obsidian: {
      backgroundColor:      '#050505',
      backdropFilter:       'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
    },
  },

  // ── Visual overhaul tokens (dual grid + scanlines) ────────────────────────
  // Mirrors: industrial.css sections 10–11 and :root --scanline-opacity
  overhaul: {
    gridMinorColor:  'rgba(0,82,255,0.05)',
    gridMajorColor:  'rgba(0,82,255,0.12)',
    scanlineOpacity: 0.08,
  },

  // ── Animation tokens — all durations and class names are defined here ──────
  // The keyframes themselves live in: frontend/src/styles/industrial.css
  animations: {
    // Timing (seconds) — the whole machine shares these rhythms
    timing: {
      heartbeat:  3,  // badge-heartbeat, rail-breathe, energy-pulse, auth-cursor, dot-pulse
      executing:  4,  // hue-shift-executing (EXECUTING column), bridge-breathe
      scan:       4,  // polygent-scan (SIGNAL DETECTED column)
      crt:        0.55, // crt-warmup (title flicker on page load)
    },
    // CSS class names (defined in industrial.css)
    classes: {
      // OpsBoard
      scanLine:       'polygent-scan-line',
      colScroll:      'polygent-col-scroll',
      railGreen:      'rail-green',
      railRed:        'rail-red',
      executingGlow:  'executing-hue-glow',
      // Header
      badgeLive:      'badge-live',
      crtTitle:       'crt-title',
      // MissionControl
      energyBar:      'stat-energy-bar',
      // OperatorBridge
      authCursor:     'auth-cursor',
      dotPulse:       'dot-pulse',
      bridgeBreathe:  'bridge-module',
    },
  },
} as const;

// ── Standalone exports for visual overhaul tokens ─────────────────────────────
export const gridMinorColor  = 'rgba(0,82,255,0.05)' as const;
export const gridMajorColor  = 'rgba(0,82,255,0.12)' as const;
export const scanlineOpacity = 0.08;
