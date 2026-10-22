import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/my-friend-driver/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
      ],
      manifest: {
        id: "/my-friend-driver/",
        name: "My Friend Driver",
        short_name: "Friend Driver",
        description:
          "Przejazdy ze znajomymi. Proste rozliczenia, zawsze pod ręką.",
        lang: "pl",
        start_url: "/my-friend-driver/",
        scope: "/my-friend-driver/",
        display: "standalone",
        background_color: "#f2f2f7",
        theme_color: "#f2f2f7",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cacheId: "my-friend-driver",
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/my-friend-driver/index.html",
        navigateFallbackAllowlist: [/^\/my-friend-driver\/(?:index\.html)?$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
