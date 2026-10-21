import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({ srcDirectory: "src" }),
    // React's plugin must come after Start's plugin.
    viteReact(),
    // Nitro builds the deployable server. Set NITRO_PRESET when deploying to a
    // platform with a specific adapter (vercel, netlify, cloudflare-pages, ...).
    nitro(),
  ],
});
