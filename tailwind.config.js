/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#6D28D9",  // Purple-700
          DEFAULT: "#5B21B6", // Purple-800
          dark: "#4C1D95",    // Purple-900
        },
        secondary: {
          light: "#FBBF24", // Yellow-400
          DEFAULT: "#F59E0B", // Yellow-500
          dark: "#B45309", // Yellow-700
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),       // better form controls
    require("@tailwindcss/typography"),  // prose classes for rich text
    require("@tailwindcss/aspect-ratio") // aspect-ratio utilities
  ],
};