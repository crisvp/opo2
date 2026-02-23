import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export type { DB } from "../db/types.js";
import type { DB } from "../db/types.js";

let _db: Kysely<DB> | null = null;

export function createDb(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });
}

export function getDb(connectionString: string): Kysely<DB> {
  if (!_db) {
    _db = createDb(connectionString);
  }
  return _db;
}
