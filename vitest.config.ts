import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const aliasConfig = {
  resolve: {
    alias: {
      "@": __dirname
    }
  }
};

export default defineConfig({
  test: {
    projects: [
      {
        ...aliasConfig,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"]
        }
      },
      {
        ...aliasConfig,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          exclude: ["tests/**/*.test.ts"]
        }
      }
    ]
  }
});
