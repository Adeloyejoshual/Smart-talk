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

  // ✅ REQUIRED for Twilio-video to avoid build/runtime failures
  optimizeDeps: {
    include: ["twilio-video"],
  },

  // ✅ Prevent Vite SSR from breaking twilio-video
  ssr: {
    noExternal: ["twilio-video"],
  },

  server: {
    port: 5173,
  },
});