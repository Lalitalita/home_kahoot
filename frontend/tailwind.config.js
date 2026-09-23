/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Warm terracotta accent — used everywhere the app used to use a
        // saturated magenta/purple. Kept under the same token name
        // ("party") so it applies wherever the class is already used,
        // including the live-quiz screens.
        party: {
          50: "#fdf6f2",
          100: "#faeade",
          200: "#f3d2b8",
          300: "#e9b389",
          400: "#dd9264",
          500: "#cc7748",
          600: "#b1602f",
          700: "#8f4c27",
          800: "#733e24",
          900: "#5e3320",
          950: "#331a10",
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
