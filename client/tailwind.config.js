/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e5edff',
          200: '#d2e0ff',
          300: '#adc8ff',
          400: '#85a3ff',
          500: '#667eea',
          600: '#5a67d8',
          700: '#4c51bf',
          800: '#434190',
          900: '#3c366b',
        },
        purple: {
          500: '#764ba2',
        },
      },
      spacing: {
        '70': '17.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'custom': '0 4px 15px rgba(0,0,0,0.05)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'modal': '0 10px 25px rgba(0,0,0,0.2)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
