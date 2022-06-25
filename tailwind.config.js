/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.js"
  ],
  theme: {
    fontFamily: {
      title: ['Catamaran', 'serif']
    },
    extend: {
      zIndex: {
        top: 20000000
      }
    },
  },
  plugins: [],
}
