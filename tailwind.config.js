/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0eff5',
          100: '#d5d3e6',
          200: '#b5b2d1',
          300: '#9491bc',
          400: '#7b78ab',
          500: '#625f9a',
          600: '#4a488a',
          700: '#3d3b6b',
          800: '#2d2b55',
          900: '#1e1b4b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'noise': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-3%, -5%)' },
          '20%': { transform: 'translate(-5%, 2%)' },
          '30%': { transform: 'translate(7%, 3%)' },
          '40%': { transform: 'translate(-3%, 6%)' },
          '50%': { transform: 'translate(5%, -4%)' },
          '60%': { transform: 'translate(-7%, 2%)' },
          '70%': { transform: 'translate(3%, 7%)' },
          '80%': { transform: 'translate(-5%, -3%)' },
          '90%': { transform: 'translate(2%, -6%)' },
        },
        'shine': {
          from: { transform: 'translateX(-100%) skewX(-12deg)' },
          to: { transform: 'translateX(200%) skewX(-12deg)' },
        },
      },
      animation: {
        'noise': 'noise 8s steps(10) infinite',
        'shine': 'shine 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
