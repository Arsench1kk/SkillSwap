import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/db", replacement: path.resolve(rootDir, "src/db") },
      { find: "@/domain", replacement: path.resolve(rootDir, "src/domain") },
      { find: "@/messages", replacement: path.resolve(rootDir, "messages") },
      { find: "@/lib", replacement: path.resolve(rootDir, "src/lib") },
      {
        find: "@/components",
        replacement: path.resolve(rootDir, "components"),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
