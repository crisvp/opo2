import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const listQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

const idParamsSchema = z.object({
  id: z.string(),
});

const setRoleSchema = z.object({
  role: z.enum(["admin", "moderator", "user"]),
});

const setTierSchema = z.object({
  tierId: z.number().int().positive(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /users — paginated user list
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/users",
    {
      schema: { querystring: listQuerySchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, _reply) => {
      const { search, role, page, pageSize } = request.query;
      const offset = (page - 1) * pageSize;

      let countQuery = fastify.db
        .selectFrom("user")
        .select(fastify.db.fn.countAll<number>().as("count"));

      if (search) {
        countQuery = countQuery.where((eb) =>
          eb.or([
            eb("name", "ilike", `%${search}%`),
            eb("email", "ilike", `%${search}%`),
          ]),
        );
      }
      if (role) {
        countQuery = countQuery.where("role", "=", role);
      }

      const countResult = await countQuery.executeTakeFirstOrThrow();
      const total = Number(countResult.count);

      let query = fastify.db
        .selectFrom("user")
        .leftJoin("user_tiers as ut", "ut.id", "user.tier")
        .select([
          "user.id",
          "user.name",
          "user.email",
          "user.role",
          "user.createdAt",
          "user.tier",
          "ut.name as tier_name",
        ])
        .orderBy("user.createdAt", "desc")
        .limit(pageSize)
        .offset(offset);

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb("user.name", "ilike", `%${search}%`),
            eb("user.email", "ilike", `%${search}%`),
          ]),
        );
      }
      if (role) {
        query = query.where("user.role", "=", role);
      }

      const rows = await query.execute();

      const items = rows.map((r) => ({
        id: r.id,
        name: r.name ?? null,
        email: r.email,
        role: r.role,
        tier: r.tier ?? null,
        tierName: r.tier_name ?? null,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      }));

      return {
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    },
  );

  // GET /users/:id — user detail
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/users/:id",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const user = await fastify.db
        .selectFrom("user")
        .leftJoin("user_tiers as ut", "ut.id", "user.tier")
        .select([
          "user.id",
          "user.name",
          "user.email",
          "user.role",
          "user.tier",
          "user.createdAt",
          "ut.name as tier_name",
        ])
        .where("user.id", "=", id)
        .executeTakeFirst();

      if (!user) {
        return reply.status(404).send({ success: false, error: "User not found" });
      }

      // Document count for this user
      const docCountResult = await fastify.db
        .selectFrom("documents")
        .select(fastify.db.fn.countAll<number>().as("count"))
        .where("uploader_id", "=", id)
        .executeTakeFirstOrThrow();
      const documentCount = Number(docCountResult.count);

      // Usage stats — aggregate api call log by limit_type
      const usageRows = await fastify.db
        .selectFrom("user_api_call_log")
        .select([
          "limit_type",
          fastify.db.fn.countAll<number>().as("count"),
        ])
        .where("user_id", "=", id)
        .groupBy("limit_type")
        .execute();

      return {
        success: true,
        data: {
          id: user.id,
          name: user.name ?? null,
          email: user.email,
          role: user.role,
          tier: user.tier ?? null,
          tierName: user.tier_name ?? null,
          createdAt:
            user.createdAt instanceof Date
              ? user.createdAt.toISOString()
              : String(user.createdAt),
          documentCount,
          usageStats: usageRows.map((u) => ({
            limitType: u.limit_type,
            count: Number(u.count),
          })),
        },
      };
    },
  );

  // PUT /users/:id/role — change role
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/users/:id/role",
    {
      schema: { params: idParamsSchema, body: setRoleSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { role } = request.body;

      const existing = await fastify.db
        .selectFrom("user")
        .select(["id", "role"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "User not found" });
      }

      // Guard: cannot demote the last admin
      const currentRole = existing.role;
      if (currentRole === "admin" && role !== "admin") {
        const adminCountResult = await fastify.db
          .selectFrom("user")
          .select(fastify.db.fn.countAll<number>().as("count"))
          .where("role", "=", "admin")
          .executeTakeFirstOrThrow();
        const adminCount = Number(adminCountResult.count);
        if (adminCount <= 1) {
          return reply.status(422).send({
            success: false,
            error: "Cannot demote the last admin",
          });
        }
      }

      await fastify.db
        .updateTable("user")
        .set({ role, updatedAt: new Date() })
        .where("id", "=", id)
        .execute();

      return { success: true, data: { id, role } };
    },
  );

  // PUT /users/:id/tier — change tier
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/users/:id/tier",
    {
      schema: { params: idParamsSchema, body: setTierSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tierId } = request.body;

      const existing = await fastify.db
        .selectFrom("user")
        .select(["id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "User not found" });
      }

      await fastify.db
        .updateTable("user")
        .set({ tier: tierId, updatedAt: new Date() })
        .where("id", "=", id)
        .execute();

      return { success: true, data: { id, tier: tierId } };
    },
  );

  // DELETE /users/:id — delete user (preserve documents)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/users/:id",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const requestingAdmin = request.user!;

      // Guard: cannot delete yourself
      if (requestingAdmin.id === id) {
        return reply.status(422).send({ success: false, error: "Cannot delete your own account" });
      }

      const existing = await fastify.db
        .selectFrom("user")
        .select(["id", "role"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "User not found" });
      }

      // Guard: cannot delete if this would leave zero admins
      const existingRole = existing.role;
      if (existingRole === "admin") {
        const adminCountResult = await fastify.db
          .selectFrom("user")
          .select(fastify.db.fn.countAll<number>().as("count"))
          .where("role", "=", "admin")
          .executeTakeFirstOrThrow();
        const adminCount = Number(adminCountResult.count);
        if (adminCount <= 1) {
          return reply.status(422).send({
            success: false,
            error: "Cannot delete the last admin",
          });
        }
      }

      // SET NULL on documents.uploader_id so documents are preserved
      await fastify.db
        .updateTable("documents")
        .set({ uploader_id: null, updated_at: new Date() })
        .where("uploader_id", "=", id)
        .execute();

      // Delete user row
      await fastify.db
        .deleteFrom("user")
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
