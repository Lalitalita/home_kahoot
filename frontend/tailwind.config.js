/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Primary accent — cyan. 400 is the exact requested base (#39e3e3);
        // darker shades give buttons/pills a readable surface, lighter
        // shades are used as glow/text-on-dark.
        party: {
          50: "#eafefe",
          100: "#c9fbfb",
          200: "#97f6f6",
          300: "#5decec",
          400: "#39e3e3",
          500: "#17c9c9",
          600: "#0fa3a3",
          700: "#127f7f",
          800: "#146565",
          900: "#145353",
          950: "#062525",
        },
        // Secondary accent — magenta, used sparingly (gradients, badges,
        // an alternate CTA) so the cyan stays the dominant signal color.
        magenta: {
          50: "#fbeafe",
          100: "#f3c9fb",
          200: "#e692f7",
          300: "#d35eef",
          400: "#bb39e3",
          500: "#9f22c7",
          600: "#7f18a0",
          700: "#661880",
          800: "#531a66",
          900: "#451a55",
          950: "#230a2c",
        },
        // Near-black neutrals for the dark UI: #121212 page background,
        // #181818 card surfaces, as requested.
        ink: {
          50: "#f2f2f2",
          100: "#dedede",
          200: "#c2c2c2",
          300: "#9e9e9e",
          400: "#7a7a7a",
          500: "#5c5c5c",
          600: "#434343",
          700: "#2e2e2e",
          800: "#1e1e1e",
          850: "#181818",
          900: "#121212",
          950: "#0a0a0a",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        serif: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        cozy: "0 12px 32px -16px rgba(0,0,0,0.7)",
        glow: "0 0 45px -12px rgba(57,227,227,0.5)",
        "glow-magenta": "0 0 45px -12px rgba(187,57,227,0.5)",
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
