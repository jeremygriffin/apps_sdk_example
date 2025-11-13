import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  server: {
    host: "0.0.0.0",
    port: 4173
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
