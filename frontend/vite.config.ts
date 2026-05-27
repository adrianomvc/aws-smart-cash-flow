import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts")) return "charts";
          if (id.includes("d3-")) return "d3";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("react") || id.includes("scheduler")) return "react";
        },
      },
    },
  },
});
