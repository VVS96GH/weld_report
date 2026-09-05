import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // `process.cwd()` rather than `__dirname` so the config loads under both the
    // CJS and the native-ESM Vite config loaders.
    alias: { "@": path.resolve(process.cwd()) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The integration suite talks to Postgres; distinct counts over 1 M rows
    // are not instant.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
