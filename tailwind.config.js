/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/views/**/*.pug", "./src/modules/**/*.pug", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        medigo: {
          navy: "#0b3b69",
          blue: "#0876c9",
          cyan: "#12b8e8",
          pale: "#eaf6ff"
        }
      }
    }
  },
  plugins: []
};
