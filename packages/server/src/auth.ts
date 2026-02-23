import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { verifySolution } from "altcha-lib";
import { Pool } from "pg";

import { env } from "./config/env.js";
import { redis } from "./util/redis.js";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: pool,
  baseURL: env.TRUSTED_ORIGINS[0],
  trustedOrigins: env.TRUSTED_ORIGINS,
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: false,
      },
      tier: {
        type: "number",
        defaultValue: 1,
        required: false,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Verify ALTCHA proof-of-work on the sign-up endpoint
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as Record<string, unknown> | undefined;
        const altchaPayload = body?.altchaPayload as string | undefined;
        if (!altchaPayload) {
          throw new APIError("BAD_REQUEST", { message: "ALTCHA verification required" });
        }

        // Parse the base64 payload to extract salt for replay prevention
        let parsedPayload: Record<string, unknown>;
        try {
          parsedPayload = JSON.parse(Buffer.from(altchaPayload, "base64").toString("utf-8")) as Record<string, unknown>;
        } catch {
          throw new APIError("BAD_REQUEST", { message: "ALTCHA verification failed: invalid payload" });
        }

        const salt = parsedPayload.salt as string | undefined;
        if (!salt) {
          throw new APIError("BAD_REQUEST", { message: "ALTCHA verification failed: missing salt" });
        }

        // Check for replay: if this salt has already been spent, reject
        const spentKey = `altcha:spent:${salt}`;
        const alreadySpent = await redis.exists(spentKey);
        if (alreadySpent) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "ALTCHA challenge already used" });
        }

        // Verify the solution
        const valid = await verifySolution(altchaPayload, env.ALTCHA_HMAC_KEY, false);
        if (!valid) {
          throw new APIError("BAD_REQUEST", { message: "ALTCHA verification failed" });
        }

        // Mark this salt as spent (TTL 10 minutes = 600 seconds)
        await redis.set(spentKey, "1", "EX", 600);
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Promote the very first user to admin
          const { rows } = await pool.query(
            'SELECT COUNT(*) as count FROM "user"',
          );
          const count = parseInt((rows[0] as { count: string }).count, 10);
          if (count === 1) {
            await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
              "admin",
              user.id,
            ]);
          }
        },
      },
    },
  },
  plugins: [twoFactor(), passkey()],
});

export type Auth = typeof auth;
