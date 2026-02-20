/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens
        void:    '#050505',
        surface: '#0f0f10',

        // Text tokens
        header:  '#f4f4f5',
        muted:   '#71717a',

        // Interactive / brand
        primary: '#3b82f6',
        agent:   '#8b5cf6',

        // Status
        success: '#22c55e',
        danger:  '#ef4444',
        warning: '#f59e0b',

        // Border (keep existing DEFAULT + strong)
        border: {
          DEFAULT: '#1E2028',
          strong:  '#2A2D38',
        },

        // Legacy bg object (keep for any existing usage)
        bg: {
          primary:   '#0A0B0E',
          secondary: '#111318',
          tertiary:  '#1A1D24',
          hover:     '#222630',
        },

        // Legacy accent object
        accent: {
          blue:   '#3B82F6',
          green:  '#10B981',
          red:    '#EF4444',
          orange: '#F59E0B',
          purple: '#8B5CF6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
