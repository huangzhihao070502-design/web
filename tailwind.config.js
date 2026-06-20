/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ink-black': '#1A1A1A',
        'ink-dark': '#3D3D3D',
        'ink-gray': '#6B6B6B',
        'ink-light': '#9E9E9E',
        'ink-white': '#E8E8E8',
        'paper-white': '#F5F2ED',
        'warm-white': '#FAF8F5',
        ochre: '#C4A574',
        cinnabar: '#B84A3E',
        'ink-green': '#4A5D4E',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Serif SC"', '"MiSans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'display': ['42px', { fontWeight: '700', letterSpacing: '16px' }],
        'hero': ['26px', { fontWeight: '700', letterSpacing: '2px' }],
        'h1': ['22px', { fontWeight: '600', letterSpacing: '2px' }],
        'h2': ['20px', { fontWeight: '600', letterSpacing: '2px' }],
        'h3': ['16px', { fontWeight: '600' }],
        'body': ['15px', { lineHeight: '1.7' }],
        'body-sm': ['14px', { lineHeight: '1.7' }],
        'caption': ['13px', { lineHeight: '1.5' }],
        'tiny': ['12px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '20px',
        'xl': '24px',
        '2xl': '28px',
        full: '50%',
      },
      boxShadow: {
        'paper-sm': '0 1px 4px rgba(0,0,0,0.04)',
        'paper-md': '0 4px 12px rgba(0,0,0,0.06)',
        'paper-lg': '0 8px 24px rgba(0,0,0,0.08)',
        'ink-sm': '0 1px 3px rgba(26,26,26,0.1)',
        'ink-md': '0 4px 8px rgba(26,26,26,0.15)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'ink-spread': { '0%': { width: '0', height: '0', opacity: '0' }, '50%': { opacity: '0.8' }, '100%': { width: '180px', height: '180px', opacity: '0.3' } },
        'breathe': { '0%, 100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease forwards',
        'ink-spread': 'ink-spread 1.2s ease-out forwards',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
