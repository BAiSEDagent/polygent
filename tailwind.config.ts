import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'void-black': '#050507',
        'surface-panel': '#0A0A0F',
        'cyan-neon': '#00F0FF',
        'matrix-green': '#10B981',
        'alert-red': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        terminal: '0 0 15px rgba(0, 240, 255, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
