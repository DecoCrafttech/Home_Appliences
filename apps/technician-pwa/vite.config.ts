import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"] },
      manifest: {
        name: "Fixbeez Technician",
        short_name: "Fixbeez Tech",
        theme_color: "#512da8",
        background_color: "#ffffff",
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
