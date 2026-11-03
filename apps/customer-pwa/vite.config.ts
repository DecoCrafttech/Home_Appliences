import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      devOptions: { enabled: true, type: "module" },
      registerType: "prompt",
      manifest: {
        name: "Fixbeez",
        short_name: "Fixbeez",
        description: "Book appliance care and track your requests",
        theme_color: "#512da8",
        background_color: "#ffffff",
        display: "standalone",
        id: "/",
        scope: "/",
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
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,avif,woff2}"],
        globIgnores: ["**/appliances/*.png"],
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
