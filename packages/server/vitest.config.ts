import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse the monorepo root .env file so integration tests have DB/Redis access
function loadDotEnv(): Record<string, string> {
  try {
    const envPath = resolve(__dirname, "../../.env");
    const raw = readFileSync(envPath, "utf8");
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key) result[key] = val;
    }
    return result;
  } catch {
    // .env not present (CI may inject vars directly)
    return {};
  }
}

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    env: loadDotEnv(),
  },
  resolve: {
    alias: {
      "@opo/shared": new URL("../shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
