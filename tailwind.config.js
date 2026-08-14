/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          brown: '#81705F',
          beige: '#E6D8C3',
          'off-white': '#F8F7F4',
          olive: '#A0896A',
          'dark-brown': '#4F3E32',
          gold: '#C08A3E',
          'gold-light': '#E7B87A',
          forest: '#4A6650',
          'forest-light': '#7A9A80',
        },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        sans: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

