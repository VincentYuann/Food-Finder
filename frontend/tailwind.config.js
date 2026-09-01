/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tomato: {
          DEFAULT: '#ff6347',
          hover: '#e5533d',
          light: '#fff5f3',
          border: '#ffd8d1',
        },
        brand: {
          50: '#fff5f3',
          100: '#ffe6e1',
          200: '#ffd0c7',
          300: '#ffaa9c',
          400: '#ff826e',
          500: '#ff6347', // Signature Tomato
          600: '#e5533d', // Tomato Hover
          700: '#c53c28',
          800: '#9d3222',
          900: '#7e2c20',
          950: '#43120b',
        },
        gold: {
          star: '#f59e0b',
        },
        surface: {
          white: '#ffffff',
          offwhite: '#fcfcfc',
          bg: '#f7f7f7',
          panel: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['Lato', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'ambient': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'container': '0 5px 25px rgba(0, 0, 0, 0.05)',
        'lift': '0 8px 25px rgba(0, 0, 0, 0.09)',
        'card': '0 4px 14px rgba(0, 0, 0, 0.06)',
        'soft': '0 2px 10px rgba(0, 0, 0, 0.04)',
        'glow-tomato': '0 4px 14px rgba(255, 99, 71, 0.28)',
      },
    },
  },
  plugins: [],
};
