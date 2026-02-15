/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0B0E',
        surface: '#111318',
        border: '#1E2028',
        primary: '#3B82F6',
        success: '#10B981',
        danger: '#EF4444',
        accent: '#8B5CF6',
        orange: '#F59E0B',
        'text-primary': '#FFFFFF',
        'text-secondary': '#6B7280',
        'text-muted': '#4B5563',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
