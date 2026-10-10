/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b1020', 900: '#111833', 800: '#1a2347', 700: '#26315c', 600: '#3a4677' },
        ring: { blue: '#1998d5' },
      },
      fontFamily: {
        sans: ['Atkinson Hyperlegible', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
