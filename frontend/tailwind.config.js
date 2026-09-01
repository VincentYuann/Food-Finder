/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f2',
          100: '#ffe8e1',
          200: '#ffd0c4',
          300: '#ffaa96',
          400: '#ff7759',
          500: '#ff5436',
          600: '#f03616',
          700: '#c9270b',
          800: '#a6240d',
          900: '#862312',
          950: '#490e05',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 8px 30px rgba(0, 0, 0, 0.06)',
        'modal': '0 20px 50px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};
