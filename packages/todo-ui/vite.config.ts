import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const reactPlugins = react() as PluginOption | PluginOption[];
const normalizedPlugins = Array.isArray(reactPlugins) ? reactPlugins : [reactPlugins];

export default defineConfig({
  plugins: normalizedPlugins,
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
