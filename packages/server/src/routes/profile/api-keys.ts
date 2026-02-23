import { randomBytes, hkdfSync, createHash, createCipheriv, createDecipheriv } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { env } from "../../config/env.js";

function deriveKey(): Buffer {
  const secret = env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("API_KEY_ENCRYPTION_SECRET not set");
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret), Buffer.from("opo-api-key-encryption"), Buffer.alloc(0), 32),
  );
}

function encryptKey(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptKey(stored: string): string {
  const key = deriveKey();
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

const putOpenRouterKeySchema = z.object({
  key: z
    .string()
    .min(20)
    .refine((k) => k.startsWith("sk-or-"), { message: "Key must start with sk-or-" }),
});

const putApiKeySettingsSchema = z.object({
  dailyLimit: z.number().int().min(1).max(100),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /api-keys — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/api-keys",
    {
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;

      const row = await fastify.db
        .selectFrom("user_api_keys")
        .select(["encrypted_key", "daily_limit"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!row) {
        return {
          success: true,
          data: { hasKey: false, maskedKey: null, dailyLimit: null },
        };
      }

      let maskedKey: string | null = null;
      try {
        const plaintext = decryptKey(row.encrypted_key);
        maskedKey = plaintext.slice(0, 12) + "...";
      } catch {
        maskedKey = null;
      }

      return {
        success: true,
        data: {
          hasKey: true,
          maskedKey,
          dailyLimit: row.daily_limit ?? null,
        },
      };
    },
  );

  // PUT /api-keys/openrouter — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/api-keys/openrouter",
    {
      schema: { body: putOpenRouterKeySchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;
      const { key } = request.body;

      const encryptedKey = encryptKey(key);
      const keyHash = hashKey(key);

      await fastify.db
        .insertInto("user_api_keys")
        .values({
          id: nanoid(),
          user_id: user.id,
          encrypted_key: encryptedKey,
          key_hash: keyHash,
          created_at: new Date(),
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            encrypted_key: encryptedKey,
            key_hash: keyHash,
          }),
        )
        .execute();

      return { success: true };
    },
  );

  // DELETE /api-keys/openrouter — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/api-keys/openrouter",
    {
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;

      await fastify.db
        .deleteFrom("user_api_keys")
        .where("user_id", "=", user.id)
        .execute();

      return { success: true };
    },
  );

  // PUT /api-keys/openrouter/settings — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/api-keys/openrouter/settings",
    {
      schema: { body: putApiKeySettingsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;
      const { dailyLimit } = request.body;

      await fastify.db
        .updateTable("user_api_keys")
        .set({ daily_limit: dailyLimit })
        .where("user_id", "=", user.id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
