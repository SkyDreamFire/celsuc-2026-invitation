/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        celsuc: {
          green: '#33A944',
          'green-dark': '#2a8a38',
          red: '#CF181C',
          'red-dark': '#a01418',
          gray: '#C5C5CB',
          dark: '#0f1a12',
          forest: '#1a3d22',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
