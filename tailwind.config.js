/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
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
        card: '0 1px 2px rgba(79, 62, 50, 0.04), 0 4px 16px rgba(79, 62, 50, 0.06)',
        'card-hover': '0 4px 8px rgba(79, 62, 50, 0.06), 0 12px 28px rgba(79, 62, 50, 0.12)',
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        sans: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

