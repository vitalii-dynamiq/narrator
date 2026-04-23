import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

// Two test profiles share this config:
//   `vitest run test/unit/**`          — fast deterministic unit + component tests.
//   `vitest run test/integration/**`   — live-API smoke tests (minutes, tokens).
//
// Each test file picks its own environment via `// @vitest-environment happy-dom`
// when it needs the DOM; defaults to node for the pure backend unit tests and
// the integration suite.
export default defineConfig({
  plugins: [react()],
  test: {
    testTimeout: 5 * 60_000,
    hookTimeout: 30_000,
    reporters: ["verbose"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
