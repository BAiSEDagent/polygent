/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#12121A',
        border: '#1E1E2E',
        primary: '#0052FF',
        success: '#00D395',
        danger: '#FF3B5C',
        accent: '#7B61FF',
        'text-primary': '#FFFFFF',
        'text-secondary': '#8888AA',
        'text-muted': '#555566',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
      },
    },
  },
  plugins: [],
};
