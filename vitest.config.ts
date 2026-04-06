import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@nexus/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@nexus/api": resolve(__dirname, "apps/api/src/index.ts"),
      "@nexus/db": resolve(__dirname, "packages/db/src/index.ts"),
      "@nexus/sdk": resolve(__dirname, "packages/sdk/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    pool: "forks",
    setupFiles: ["./tests/setup.ts"],
  },
});
