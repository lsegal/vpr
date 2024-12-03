import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    sequence: {
      concurrent: true,
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
