import { defineConfig } from "vitest/config";

const alias = {
  "@": new URL(".", import.meta.url).pathname
};

export default defineConfig({
  resolve: {
    alias
  },
  test: {
    projects: [
      {
        resolve: {
          alias
        },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"]
        }
      },
      {
        resolve: {
          alias
        },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["./tests/setup.ts"]
        }
      }
    ]
  }
});
