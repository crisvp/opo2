import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const paramsLevelSchema = z.object({
  level: z.string(),
});

const paramsLevelStateSchema = z.object({
  level: z.string(),
  state: z.string(),
});

const paramsLevelStatePlaceSchema = z.object({
  level: z.string(),
  state: z.string(),
  place: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  async function handleOverview(
    level: string,
    state: string | undefined,
    place: string | undefined,
  ) {
    // Build base document filter
    type DocFilter = {
      government_level?: string;
      state_usps?: string;
      place_geoid?: string;
    };

    const docFilter: DocFilter = {};
    if (level === "federal") {
      docFilter.government_level = "federal";
    } else if (level === "state" && state) {
      docFilter.state_usps = state;
    } else if (level === "place" && place) {
      docFilter.place_geoid = place;
    }

    // Count approved documents
    let countQuery = fastify.db
      .selectFrom("documents")
      .select(fastify.db.fn.countAll<number>().as("count"))
      .where("state", "=", "approved");

    if (docFilter.government_level) {
      countQuery = countQuery.where("government_level", "=", docFilter.government_level) as typeof countQuery;
    }
    if (docFilter.state_usps) {
      countQuery = countQuery.where("state_usps", "=", docFilter.state_usps) as typeof countQuery;
    }
    if (docFilter.place_geoid) {
      countQuery = countQuery.where("place_geoid", "=", docFilter.place_geoid) as typeof countQuery;
    }

    const countResult = await countQuery.executeTakeFirst();
    const documentCount = Number(countResult?.count ?? 0);

    // Documents by category
    let catQuery = fastify.db
      .selectFrom("documents")
      .select(["category", fastify.db.fn.countAll<number>().as("cnt")])
      .where("state", "=", "approved")
      .groupBy("category");

    if (docFilter.government_level) {
      catQuery = catQuery.where("government_level", "=", docFilter.government_level) as typeof catQuery;
    }
    if (docFilter.state_usps) {
      catQuery = catQuery.where("state_usps", "=", docFilter.state_usps) as typeof catQuery;
    }
    if (docFilter.place_geoid) {
      catQuery = catQuery.where("place_geoid", "=", docFilter.place_geoid) as typeof catQuery;
    }

    const catRows = await catQuery.execute();
    const documentsByCategory: Record<string, number> = {};
    for (const row of catRows) {
      if (row.category) {
        documentsByCategory[row.category as string] = Number(row.cnt);
      }
    }

    // Policies — query actual approved documents matching each policy type
    const policyTypeRows = await fastify.db
      .selectFrom("policy_types")
      .select(["id", "name"])
      .orderBy("name", "asc")
      .execute();

    const policies = await Promise.all(
      policyTypeRows.map(async (pt) => {
        const typeName = pt.name as string;
        // Build policy document query: approved doc with category matching policy type name
        let policyQuery = fastify.db
          .selectFrom("documents")
          .select(["id"])
          .where("state", "=", "approved")
          .where("category" as never, "=" as never, typeName as never);

        if (docFilter.government_level) {
          policyQuery = policyQuery.where("government_level", "=", docFilter.government_level) as typeof policyQuery;
        }
        if (docFilter.state_usps) {
          policyQuery = policyQuery.where("state_usps", "=", docFilter.state_usps) as typeof policyQuery;
        }
        if (docFilter.place_geoid) {
          policyQuery = policyQuery.where("place_geoid", "=", docFilter.place_geoid) as typeof policyQuery;
        }

        const policyDoc = await policyQuery.limit(1).executeTakeFirst();

        return {
          typeId: pt.id as string,
          typeName,
          exists: policyDoc !== undefined,
          documentId: policyDoc ? (policyDoc.id as string) : null,
        };
      }),
    );

    // Vendors — catalog entries of type "vendor" linked to documents in scope
    let vendorQuery = fastify.db
      .selectFrom("document_catalog_associations as dca")
      .innerJoin("catalog_entries as ce", "ce.id", "dca.entry_id")
      .innerJoin("catalog_types as ct", "ct.id", "ce.type_id")
      .innerJoin("documents as d", "d.id", "dca.document_id")
      .select(["ce.id", "ce.name", fastify.db.fn.countAll<number>().as("doc_count")])
      .where("ct.name", "=", "vendor")
      .where("d.state", "=", "approved")
      .groupBy(["ce.id", "ce.name"])
      .orderBy("ce.name", "asc");

    if (docFilter.government_level) {
      vendorQuery = vendorQuery.where("d.government_level", "=", docFilter.government_level) as typeof vendorQuery;
    }
    if (docFilter.state_usps) {
      vendorQuery = vendorQuery.where("d.state_usps", "=", docFilter.state_usps) as typeof vendorQuery;
    }
    if (docFilter.place_geoid) {
      vendorQuery = vendorQuery.where("d.place_geoid", "=", docFilter.place_geoid) as typeof vendorQuery;
    }

    const vendorRows = await vendorQuery.execute();
    const vendors = vendorRows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      documentCount: Number(r.doc_count),
    }));

    // Technologies — catalog entries of type "technology" linked to documents in scope
    let techQuery = fastify.db
      .selectFrom("document_catalog_associations as dca")
      .innerJoin("catalog_entries as ce", "ce.id", "dca.entry_id")
      .innerJoin("catalog_types as ct", "ct.id", "ce.type_id")
      .innerJoin("documents as d", "d.id", "dca.document_id")
      .select(["ce.id", "ce.name", fastify.db.fn.countAll<number>().as("doc_count")])
      .where("ct.name", "=", "technology")
      .where("d.state", "=", "approved")
      .groupBy(["ce.id", "ce.name"])
      .orderBy("ce.name", "asc");

    if (docFilter.government_level) {
      techQuery = techQuery.where("d.government_level", "=", docFilter.government_level) as typeof techQuery;
    }
    if (docFilter.state_usps) {
      techQuery = techQuery.where("d.state_usps", "=", docFilter.state_usps) as typeof techQuery;
    }
    if (docFilter.place_geoid) {
      techQuery = techQuery.where("d.place_geoid", "=", docFilter.place_geoid) as typeof techQuery;
    }

    const techRows = await techQuery.execute();
    const technologies = techRows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      documentCount: Number(r.doc_count),
    }));

    // Agencies — if state is provided, return state agencies for that state
    let agencies: { id: string; name: string; category: string | null; documentCount: number }[] = [];
    if (state) {
      const agencyRows = await fastify.db
        .selectFrom("state_agencies")
        .select(["id", "name", "category"])
        .where("state_usps", "=", state)
        .orderBy("name", "asc")
        .execute();

      agencies = agencyRows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        category: (r.category ?? null) as string | null,
        documentCount: 0, // F17 handles agency-doc associations
      }));
    }

    // State metadata — if state is provided
    let stateMetadata: { key: string; value: string; url: string | null }[] = [];
    if (state) {
      const metaRows = await fastify.db
        .selectFrom("state_metadata")
        .select(["key", "value", "url"])
        .where("state_usps", "=", state)
        .orderBy("key", "asc")
        .execute();

      stateMetadata = metaRows.map((r) => ({
        key: r.key as string,
        value: r.value as string,
        url: (r.url ?? null) as string | null,
      }));
    }

    return {
      success: true,
      data: {
        documentCount,
        documentsByCategory,
        policies,
        vendors,
        technologies,
        agencies,
        stateMetadata,
      },
    };
  }

  // GET /overview/:level
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/overview/:level",
    {
      schema: {
        params: paramsLevelSchema,
      },
    },
    async (request, _reply) => {
      const { level } = request.params;
      return handleOverview(level, undefined, undefined);
    },
  );

  // GET /overview/:level/:state
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/overview/:level/:state",
    {
      schema: {
        params: paramsLevelStateSchema,
      },
    },
    async (request, _reply) => {
      const { level, state } = request.params;
      return handleOverview(level, state, undefined);
    },
  );

  // GET /overview/:level/:state/:place
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/overview/:level/:state/:place",
    {
      schema: {
        params: paramsLevelStatePlaceSchema,
      },
    },
    async (request, _reply) => {
      const { level, state, place } = request.params;
      return handleOverview(level, state, place);
    },
  );
};

export default plugin;
