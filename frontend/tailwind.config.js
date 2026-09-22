/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        party: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
          700: "#a21caf",
          800: "#86198f",
          900: "#701a75",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.7)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        confetti: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: 1 },
          "100%": { transform: "translateY(110vh) rotate(360deg)", opacity: 0.8 },
        },
      },
      animation: {
        "pop-in": "pop-in 0.3s ease-out",
        confetti: "confetti linear forwards",
      },
    },
  },
  plugins: [],
};
