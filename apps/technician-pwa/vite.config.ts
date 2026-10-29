import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Home Services Technician",
        short_name: "HS Technician",
        theme_color: "#512da8",
        background_color: "#f7f2ff",
        display: "standalone",
        id: "/technician",
        scope: "/",
        start_url: "/technician",
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
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  optimizeDeps: { force: true },
  server: {
    host: "localhost",
    port: 5175,
    strictPort: true,
    proxy: { "/api": "http://localhost:3001" },
  },
});


