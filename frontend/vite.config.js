import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Kahoot Anniv Lana",
        short_name: "Anniv Lana",
        description: "L'app officielle de l'anniversaire de Lana : invités, quiz, planning, galerie.",
        theme_color: "#121212",
        background_color: "#121212",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "fr",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Live quiz/party data (leaderboard, questions, settings...) must
        // always hit the network — never let the service worker serve a
        // stale API response during the party.
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/uploads": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
