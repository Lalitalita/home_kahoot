/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Warm terracotta accent — the app's single accent color, used on
        // both surfaces below.
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
        // Warm dark neutrals (brown-black, never blue-slate) for the
        // "cozy evening" surfaces: page background, cards, borders, text.
        ink: {
          50: "#f6f0e8",
          100: "#e9dfd2",
          200: "#cfc0ac",
          300: "#ab9880",
          400: "#8a7660",
          500: "#6b5946",
          600: "#4f4133",
          700: "#3a2f25",
          800: "#291f18",
          850: "#20180f",
          900: "#1a130d",
          950: "#120d08",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        serif: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        cozy: "0 12px 32px -16px rgba(0,0,0,0.55)",
        glow: "0 0 70px -20px rgba(221,146,100,0.45)",
      },
      backgroundImage: {
        "warm-radial":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(221,146,100,0.16), transparent)",
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
