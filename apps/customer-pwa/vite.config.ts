import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Home Services",
        short_name: "Home Services",
        description: "Book appliance care and track your requests",
        theme_color: "#512da8",
        background_color: "#f7f2ff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
    proxy: { "/api": "http://localhost:3001" },
  },
  preview: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
    proxy: { "/api": "http://localhost:3001" },
  },
});

// Refresh the local module graph after query-key consolidation.

