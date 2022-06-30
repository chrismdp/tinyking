/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.js"
  ],
  safelist: [
    {
      pattern: /bg-.+/
    }
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
