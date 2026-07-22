import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from GitHub Pages at /alpha-dashboard/
export default defineConfig({
  base: "/alpha-dashboard/",
  plugins: [react()],
});
