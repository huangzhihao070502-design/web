/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#94C1D6',
        secondary: '#747CBB',
        accent: '#BBA2CA',
        'gray-20': '#B1BQB8',
        'black-50': '#343030',
        'white-80': '#F6F6F6',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'title': ['20px', { fontWeight: '700' }],
        'main': ['18px', { lineHeight: '1.5' }],
        'sub': ['16px', { lineHeight: '1.5' }],
        'body': ['14px', { lineHeight: '1.6' }],
        'caption': ['12px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        'bubble': '20px',
        'card': '16px',
        'btn': '12px',
        'input': '24px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dot': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease-out',
        'bounce-dot': 'bounce-dot 1.2s ease-in-out infinite',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
