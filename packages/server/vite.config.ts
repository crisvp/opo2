import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    outDir: "dist",
    ssr: true,
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("/"),
    },
  },
  resolve: {
    alias: {
      "@opo/shared": resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});
