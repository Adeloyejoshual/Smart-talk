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

  // ✅ Required dependencies to pre-bundle
  optimizeDeps: {
    include: ["twilio-video", "react-easy-crop"],
  },

  // ✅ Prevent Vite SSR from breaking these ESM packages
  ssr: {
    noExternal: ["twilio-video", "react-easy-crop"],
  },

  server: {
    port: 5173,
  },
});