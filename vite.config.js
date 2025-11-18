import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },

  // ✅ Pre-bundle some problematic deps
  optimizeDeps: {
    include: ["twilio-video", "react-easy-crop"],
  },

  // ✅ Prevent SSR from breaking for certain packages
  ssr: {
    noExternal: ["twilio-video", "react-easy-crop"],
  },

  server: {
    port: 5173,
  },
});