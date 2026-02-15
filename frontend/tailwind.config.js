/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0A0B0E', secondary: '#111318', tertiary: '#1A1D24', hover: '#222630' },
        border: { DEFAULT: '#1E2028', strong: '#2A2D38' },
        accent: { blue: '#3B82F6', green: '#10B981', red: '#EF4444', orange: '#F59E0B', purple: '#8B5CF6' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
