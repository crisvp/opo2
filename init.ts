/**
 * init.ts — Run once to generate secrets and create .env
 *
 * Usage: pnpm init
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env");
const EXAMPLE_FILE = resolve(process.cwd(), ".env.example");

function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function main() {
  if (!existsSync(EXAMPLE_FILE)) {
    console.error(".env.example not found");
    process.exit(1);
  }

  let content = readFileSync(EXAMPLE_FILE, "utf8");

  // Generate secrets
  const betterAuthSecret = generateSecret(32);
  const altchaHmacKey = generateSecret(32);
  const apiKeyEncryptionSecret = generateSecret(32);

  content = content
    .replace(/^BETTER_AUTH_SECRET=$/m, `BETTER_AUTH_SECRET=${betterAuthSecret}`)
    .replace(/^ALTCHA_HMAC_KEY=$/m, `ALTCHA_HMAC_KEY=${altchaHmacKey}`)
    .replace(
      /^API_KEY_ENCRYPTION_SECRET=$/m,
      `API_KEY_ENCRYPTION_SECRET=${apiKeyEncryptionSecret}`,
    );

  if (existsSync(ENV_FILE)) {
    console.log(".env already exists — not overwriting. Generated values:");
    console.log(`  BETTER_AUTH_SECRET=${betterAuthSecret}`);
    console.log(`  ALTCHA_HMAC_KEY=${altchaHmacKey}`);
    console.log(`  API_KEY_ENCRYPTION_SECRET=${apiKeyEncryptionSecret}`);
  } else {
    writeFileSync(ENV_FILE, content, "utf8");
    console.log(".env created with generated secrets.");
    console.log("Default credentials match docker-compose dev setup (postgres/redis/rustfs).");
    console.log("Run 'pnpm migrate' after starting docker-compose to apply the schema.");
  }
}

main();
