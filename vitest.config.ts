import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "external-node-sqlite",
      resolveId(id) {
        if (id === "node:sqlite" || id === "sqlite") {
          return { id: "node:sqlite", external: true };
        }
        return null;
      }
    }
  ],
  test: {
    environment: "node",
    pool: "forks",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "frontend/**"]
  },
  ssr: {
    external: ["node:sqlite", "sqlite"]
  }
});
