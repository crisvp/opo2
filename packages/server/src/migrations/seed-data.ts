/**
 * Seed script — populates reference data: states, tribes, places, and catalog entries.
 * Usage: pnpm --filter server seed
 * Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
 */
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data");

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_ADMIN_URL or DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dataFile(name: string): string {
  return resolve(DATA_DIR, name);
}

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Strip common Census place type suffixes from a place name. */
function stripPlaceSuffix(name: string): string {
  // Ordered longest-first to avoid partial matches
  const suffixes = [
    " metro government (balance)",
    " consolidated government (balance)",
    " unified government (balance)",
    " government (balance)",
    " (balance)",
    " municipality",
    " plantation",
    " township",
    " borough",
    " village",
    " town",
    " city",
    " cdp",
    " boro",
    " county",
  ];
  const lower = name.toLowerCase();
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) {
      return name.slice(0, name.length - suffix.length).trim();
    }
  }
  return name;
}

/** Parse a simple CSV line respecting double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

// ---------------------------------------------------------------------------
// Seeders
// ---------------------------------------------------------------------------

async function seedStates(client: import("pg").PoolClient) {
  console.log("Seeding states…");

  const states = [
    { usps: "AL", name: "Alabama",                   territory: false },
    { usps: "AK", name: "Alaska",                    territory: false },
    { usps: "AZ", name: "Arizona",                   territory: false },
    { usps: "AR", name: "Arkansas",                  territory: false },
    { usps: "CA", name: "California",                territory: false },
    { usps: "CO", name: "Colorado",                  territory: false },
    { usps: "CT", name: "Connecticut",               territory: false },
    { usps: "DE", name: "Delaware",                  territory: false },
    { usps: "FL", name: "Florida",                   territory: false },
    { usps: "GA", name: "Georgia",                   territory: false },
    { usps: "HI", name: "Hawaii",                    territory: false },
    { usps: "ID", name: "Idaho",                     territory: false },
    { usps: "IL", name: "Illinois",                  territory: false },
    { usps: "IN", name: "Indiana",                   territory: false },
    { usps: "IA", name: "Iowa",                      territory: false },
    { usps: "KS", name: "Kansas",                    territory: false },
    { usps: "KY", name: "Kentucky",                  territory: false },
    { usps: "LA", name: "Louisiana",                 territory: false },
    { usps: "ME", name: "Maine",                     territory: false },
    { usps: "MD", name: "Maryland",                  territory: false },
    { usps: "MA", name: "Massachusetts",             territory: false },
    { usps: "MI", name: "Michigan",                  territory: false },
    { usps: "MN", name: "Minnesota",                 territory: false },
    { usps: "MS", name: "Mississippi",               territory: false },
    { usps: "MO", name: "Missouri",                  territory: false },
    { usps: "MT", name: "Montana",                   territory: false },
    { usps: "NE", name: "Nebraska",                  territory: false },
    { usps: "NV", name: "Nevada",                    territory: false },
    { usps: "NH", name: "New Hampshire",             territory: false },
    { usps: "NJ", name: "New Jersey",                territory: false },
    { usps: "NM", name: "New Mexico",                territory: false },
    { usps: "NY", name: "New York",                  territory: false },
    { usps: "NC", name: "North Carolina",            territory: false },
    { usps: "ND", name: "North Dakota",              territory: false },
    { usps: "OH", name: "Ohio",                      territory: false },
    { usps: "OK", name: "Oklahoma",                  territory: false },
    { usps: "OR", name: "Oregon",                    territory: false },
    { usps: "PA", name: "Pennsylvania",              territory: false },
    { usps: "RI", name: "Rhode Island",              territory: false },
    { usps: "SC", name: "South Carolina",            territory: false },
    { usps: "SD", name: "South Dakota",              territory: false },
    { usps: "TN", name: "Tennessee",                 territory: false },
    { usps: "TX", name: "Texas",                     territory: false },
    { usps: "UT", name: "Utah",                      territory: false },
    { usps: "VT", name: "Vermont",                   territory: false },
    { usps: "VA", name: "Virginia",                  territory: false },
    { usps: "WA", name: "Washington",                territory: false },
    { usps: "WV", name: "West Virginia",             territory: false },
    { usps: "WI", name: "Wisconsin",                 territory: false },
    { usps: "WY", name: "Wyoming",                   territory: false },
    { usps: "DC", name: "District of Columbia",      territory: true  },
    { usps: "PR", name: "Puerto Rico",               territory: true  },
    { usps: "VI", name: "Virgin Islands",            territory: true  },
    { usps: "GU", name: "Guam",                      territory: true  },
    { usps: "AS", name: "American Samoa",            territory: true  },
    { usps: "MP", name: "Northern Mariana Islands",  territory: true  },
  ];

  const values = states
    .map(({ usps, name, territory }) => `(${q(usps)}, ${q(name)}, ${territory})`)
    .join(",\n  ");

  await client.query(`
    INSERT INTO states (usps, name, is_territory) VALUES
      ${values}
    ON CONFLICT (usps) DO NOTHING
  `);

  console.log(`  ✓ ${states.length} states`);
}

async function seedTribes(client: import("pg").PoolClient) {
  console.log("Seeding tribes…");

  const content = readFileSync(dataFile("tribes.txt"), "utf-8");
  const lines = content.split("\n");

  const tribes: { id: string; name: string; is_alaska_native: boolean }[] = [];
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;
    const name = line.trim();
    if (!name) continue;
    // Lines 350+ are Alaska Native entities per BIA list ordering
    tribes.push({
      id: String(lineNum),
      name,
      is_alaska_native: lineNum >= 350,
    });
  }

  const BATCH = 100;
  for (let i = 0; i < tribes.length; i += BATCH) {
    const batch = tribes.slice(i, i + BATCH);
    const values = batch
      .map(({ id, name, is_alaska_native }) => `(${q(id)}, ${q(name)}, ${is_alaska_native})`)
      .join(",\n      ");
    await client.query(`
      INSERT INTO tribes (id, name, is_alaska_native) VALUES
        ${values}
      ON CONFLICT (id) DO NOTHING
    `);
  }

  console.log(`  ✓ ${tribes.length} tribes`);
}

async function seedPlaces(client: import("pg").PoolClient) {
  console.log("Seeding places from gazetteer…");

  // Collect valid state codes first
  const { rows: stateRows } = await client.query<{ usps: string }>(
    "SELECT usps FROM states",
  );
  const validStates = new Set(stateRows.map((r) => r.usps));

  interface PlaceRow {
    geoid: string;
    usps: string;
    name: string;
    lsad: string;
    funcstat: string;
    lat: number;
    lon: number;
    aland_sqmi: number;
  }

  const places: PlaceRow[] = [];

  const rl = createInterface({
    input: createReadStream(dataFile("2025_Gaz_place_national.txt")),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // header

    // Strip null bytes from entire line before splitting to avoid column misalignment
    const parts = line.replace(/\0/g, "").split("|");
    if (parts.length < 13) continue;

    const [usps, geoid, , , rawName, lsad, funcstat, , , alandSqmi, , lat, lon] = parts;

    if (!validStates.has(usps.trim())) continue;

    const clean = (s: string) => s.trim();
    const name = stripPlaceSuffix(clean(rawName));

    places.push({
      geoid: clean(geoid),
      usps: clean(usps),
      name,
      lsad: clean(lsad).slice(0, 10), // LSAD codes are 2 chars; guard against any edge case
      funcstat: clean(funcstat).slice(0, 5),
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      aland_sqmi: parseFloat(alandSqmi) || 0,
    });
  }

  // Clear existing and re-insert
  await client.query("DELETE FROM places");

  // Use parameterized queries (8 params per row) to safely handle all characters
  const COLS = 8;
  const BATCH = 200; // 200 * 8 = 1600 params, well under the 65535 limit
  for (let i = 0; i < places.length; i += BATCH) {
    const batch = places.slice(i, i + BATCH);
    const placeholders = batch
      .map((_, idx) => {
        const b = idx * COLS;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
      })
      .join(",\n        ");
    const params = batch.flatMap(({ geoid, usps, name, lsad, funcstat, lat, lon, aland_sqmi }) => [
      geoid, usps, name, lsad, funcstat, lat, lon, aland_sqmi,
    ]);

    await client.query(
      `INSERT INTO places (geoid, usps, name, lsad, funcstat, lat, lon, aland_sqmi) VALUES
        ${placeholders}
      ON CONFLICT (geoid) DO UPDATE SET
        name       = EXCLUDED.name,
        lsad       = EXCLUDED.lsad,
        funcstat   = EXCLUDED.funcstat,
        lat        = EXCLUDED.lat,
        lon        = EXCLUDED.lon,
        aland_sqmi = EXCLUDED.aland_sqmi`,
      params,
    );

    if ((i + BATCH) % 5000 === 0 || i + BATCH >= places.length) {
      console.log(`  ${Math.min(i + BATCH, places.length)} / ${places.length}`);
    }
  }

  console.log(`  ✓ ${places.length} places`);
}

/** Strip the county-type suffix from a county name and return { name, lsad }. */
function parseCountyName(fullName: string): { name: string; lsad: string } {
  // Ordered longest-first to avoid partial matches
  const suffixes = [
    "City and Borough",
    "Unified Government",
    "Metropolitan Government",
    "Consolidated Government",
    "Planning Region",
    "Census Area",
    "Municipality",
    "Borough",
    "Parish",
    "County",
    "District",
    "Island",
    "City",
  ];
  for (const suffix of suffixes) {
    if (fullName.endsWith(` ${suffix}`)) {
      return { name: fullName.slice(0, fullName.length - suffix.length - 1).trim(), lsad: suffix };
    }
  }
  return { name: fullName, lsad: "" };
}

async function seedCounties(client: import("pg").PoolClient) {
  console.log("Seeding counties from gazetteer…");

  const { rows: stateRows } = await client.query<{ usps: string }>("SELECT usps FROM states");
  const validStates = new Set(stateRows.map((r) => r.usps));

  interface CountyRow {
    geoid: string;
    usps: string;
    name: string;
    lsad: string;
    lat: number;
    lon: number;
    aland_sqmi: number;
  }

  const counties: CountyRow[] = [];

  const rl = createInterface({
    input: createReadStream(dataFile("2025_Gaz_counties_national.txt")),
    crlfDelay: Infinity,
  });

  // Format: USPS|GEOID|GEOIDFQ|ANSICODE|NAME|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG
  let lineNum = 0;
  for await (const rawLine of rl) {
    lineNum++;
    if (lineNum === 1) continue;

    const parts = rawLine.replace(/\0/g, "").split("|");
    if (parts.length < 11) continue;

    const [usps, geoid, , , fullName, , , alandSqmi, , lat, lon] = parts;
    const clean = (s: string) => s.trim();

    if (!validStates.has(clean(usps))) continue;

    const { name, lsad } = parseCountyName(clean(fullName));

    counties.push({
      geoid: clean(geoid),
      usps: clean(usps),
      name,
      lsad,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      aland_sqmi: parseFloat(alandSqmi) || 0,
    });
  }

  const COLS = 8;
  const BATCH = 200;
  for (let i = 0; i < counties.length; i += BATCH) {
    const batch = counties.slice(i, i + BATCH);
    const placeholders = batch
      .map((_, idx) => {
        const b = idx * COLS;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
      })
      .join(",\n        ");
    const params = batch.flatMap(({ geoid, usps, name, lsad, lat, lon, aland_sqmi }) => [
      geoid, usps, name, lsad, "A", lat, lon, aland_sqmi,
    ]);

    await client.query(
      `INSERT INTO places (geoid, usps, name, lsad, funcstat, lat, lon, aland_sqmi) VALUES
        ${placeholders}
      ON CONFLICT (geoid) DO UPDATE SET
        name       = EXCLUDED.name,
        lsad       = EXCLUDED.lsad,
        funcstat   = EXCLUDED.funcstat,
        lat        = EXCLUDED.lat,
        lon        = EXCLUDED.lon,
        aland_sqmi = EXCLUDED.aland_sqmi`,
      params,
    );
  }

  console.log(`  ✓ ${counties.length} counties`);
}

async function seedStateMetadata(client: import("pg").PoolClient) {
  console.log("Seeding state metadata…");

  interface MetadataItem {
    key: string;
    value: string;
    url?: string;
  }
  interface RawStateMetadata {
    usps: string;
    metadata: MetadataItem[];
  }

  const raw: RawStateMetadata[] = JSON.parse(
    readFileSync(dataFile("state_metadata.json"), "utf-8"),
  );

  const rows: { usps: string; key: string; value: string; url: string | null }[] = [];
  for (const entry of raw) {
    for (const item of entry.metadata) {
      rows.push({ usps: entry.usps, key: item.key, value: item.value, url: item.url ?? null });
    }
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = batch
      .map(({ usps, key, value, url }) =>
        `(${q(randomUUID())}, ${q(usps)}, ${q(key)}, ${q(value)}, ${url === null ? "NULL" : q(url)}, now(), now())`,
      )
      .join(",\n      ");
    await client.query(`
      INSERT INTO state_metadata (id, state_usps, key, value, url, created_at, updated_at) VALUES
        ${values}
      ON CONFLICT (state_usps, key) DO NOTHING
    `);
    inserted += batch.length;
  }

  console.log(`  ✓ ${inserted} metadata items`);
}

async function seedCatalog(client: import("pg").PoolClient) {
  console.log("Seeding catalog entries (vendors, products, technologies)…");

  const csvContent = readFileSync(dataFile("vendors-products-seed.csv"), "utf-8");
  const lines = csvContent.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());

  interface CsvRow {
    vendor_name: string;
    vendor_description: string;
    vendor_url: string;
    product_name: string;
    product_description: string;
    product_url: string;
    technologies: string;
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row as unknown as CsvRow);
  }

  // Collect unique technologies
  const allTechs = new Set<string>();
  const vendorsMap = new Map<string, {
    name: string; description: string; url: string;
    products: { name: string; description: string; url: string; techs: string[] }[];
  }>();

  for (const row of rows) {
    const techs = row.technologies ? row.technologies.split("|").map((t) => t.trim()).filter(Boolean) : [];
    for (const t of techs) allTechs.add(t);

    const key = row.vendor_name.toLowerCase();
    if (!vendorsMap.has(key)) {
      vendorsMap.set(key, { name: row.vendor_name, description: row.vendor_description, url: row.vendor_url, products: [] });
    }
    vendorsMap.get(key)!.products.push({
      name: row.product_name,
      description: row.product_description,
      url: row.product_url,
      techs,
    });
  }

  // 0. Ensure catalog association types exist (idempotent — same as migration 003)
  await client.query(`
    INSERT INTO association_types (id, name, applies_to, is_directional, inverse_id, is_system, sort_order) VALUES
      ('makes',           'Makes',           'catalog_catalog', true, 'made_by',         true, 10),
      ('made_by',         'Made By',         'catalog_catalog', true, 'makes',           true, 11),
      ('uses_technology', 'Uses Technology', 'catalog_catalog', true, 'used_by_product', true, 12),
      ('used_by_product', 'Used By Product', 'catalog_catalog', true, 'uses_technology', true, 13)
    ON CONFLICT (id) DO NOTHING
  `);

  // 1. Technologies — canonical pretty names + aliases
  const TECH_MAP: Record<string, { name: string; aliases: string[] }> = {
    alpr:                  { name: "ALPR",                        aliases: ["alpr", "LPR", "License Plate Recognition", "ALPR Systems"] },
    body_camera:           { name: "Body Camera",                 aliases: ["body_camera", "BWC", "Body-Worn Camera"] },
    csli:                  { name: "CSLI",                        aliases: ["csli", "Cell-Site Location Information", "Cell Location Data"] },
    drone:                 { name: "Drone / UAS",                 aliases: ["drone", "UAS", "UAV", "Unmanned Aerial System"] },
    facial_recognition:    { name: "Facial Recognition",          aliases: ["facial_recognition", "Face Recognition", "Facial ID"] },
    geofence:              { name: "Geofencing",                  aliases: ["geofence", "Geofence Warrant"] },
    gunshot_detection:     { name: "Gunshot Detection",           aliases: ["gunshot_detection", "ShotSpotter", "Acoustic Gunshot Detection"] },
    osint:                 { name: "OSINT",                       aliases: ["osint", "Open Source Intelligence"] },
    predictive_policing:   { name: "Predictive Policing",         aliases: ["predictive_policing"] },
    social_media_monitoring: { name: "Social Media Monitoring",   aliases: ["social_media_monitoring", "Social Media Surveillance"] },
    stingray:              { name: "Cell-Site Simulator",         aliases: ["stingray", "Stingray", "IMSI Catcher"] },
    video_analytics:       { name: "Video Analytics",             aliases: ["video_analytics", "Video Surveillance Analytics"] },
  };

  for (const techKey of allTechs) {
    const mapping = TECH_MAP[techKey];
    const prettyName = mapping?.name ?? techKey;
    const aliases = mapping?.aliases ?? [techKey];

    // Rename any existing entry that still has the old snake_case name
    if (mapping && techKey !== prettyName) {
      await client.query(
        `UPDATE catalog_entries SET name = $1, updated_at = now()
         WHERE type_id = 'technology' AND name = $2`,
        [prettyName, techKey],
      );
    }

    // Insert canonical entry (no-op if already exists)
    const id = randomUUID();
    await client.query(
      `INSERT INTO catalog_entries (id, type_id, name, attributes, is_verified, created_at, updated_at)
       VALUES ($1, 'technology', $2, $3, true, now(), now())
       ON CONFLICT (type_id, name) DO NOTHING`,
      [id, prettyName, JSON.stringify({ description: null })],
    );

    // Get canonical entry id
    const { rows: [techRow] } = await client.query<{ id: string }>(
      `SELECT id FROM catalog_entries WHERE type_id = 'technology' AND name = $1`,
      [prettyName],
    );
    if (!techRow) continue;

    // Merge any duplicate technology entries (e.g. old manually-inserted variants)
    // Find all other technology entries whose name matches one of our aliases
    const aliasPatterns = aliases.filter((a) => a !== prettyName);
    for (const aliasName of aliasPatterns) {
      const { rows: dupes } = await client.query<{ id: string }>(
        `SELECT id FROM catalog_entries WHERE type_id = 'technology' AND name = $1 AND id != $2`,
        [aliasName, techRow.id],
      );
      for (const dupe of dupes) {
        // Reassign associations
        await client.query(
          `UPDATE catalog_entry_associations SET source_entry_id = $1 WHERE source_entry_id = $2`,
          [techRow.id, dupe.id],
        );
        await client.query(
          `UPDATE catalog_entry_associations SET target_entry_id = $1 WHERE target_entry_id = $2`,
          [techRow.id, dupe.id],
        );
        // Delete duplicate
        await client.query(`DELETE FROM catalog_entries WHERE id = $1`, [dupe.id]);
      }
    }

    // Insert aliases
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      await client.query(
        `INSERT INTO catalog_aliases (id, entry_id, alias, normalized_alias, source, created_at)
         VALUES ($1, $2, $3, $4, 'import', now())
         ON CONFLICT (entry_id, normalized_alias) DO NOTHING`,
        [randomUUID(), techRow.id, alias, normalizedAlias],
      );
    }
  }

  // 2. Vendors + products
  for (const vendor of vendorsMap.values()) {
    const vendorId = randomUUID();
    await client.query(
      `INSERT INTO catalog_entries (id, type_id, name, attributes, is_verified, created_at, updated_at)
       VALUES ($1, 'vendor', $2, $3, true, now(), now())
       ON CONFLICT (type_id, name) DO NOTHING`,
      [vendorId, vendor.name, JSON.stringify({ description: vendor.description, homepage_url: vendor.url })],
    );

    for (const product of vendor.products) {
      const productId = randomUUID();
      await client.query(
        `INSERT INTO catalog_entries (id, type_id, name, attributes, is_verified, created_at, updated_at)
         VALUES ($1, 'product', $2, $3, true, now(), now())
         ON CONFLICT (type_id, name) DO NOTHING`,
        [productId, product.name, JSON.stringify({ description: product.description, homepage_url: product.url || null })],
      );
    }
  }

  // 3. Associations: vendor→product (makes), product→technology (uses_technology)
  for (const vendor of vendorsMap.values()) {
    const { rows: [vendorRow] } = await client.query<{ id: string }>(
      `SELECT id FROM catalog_entries WHERE type_id = 'vendor' AND name = $1`,
      [vendor.name],
    );
    if (!vendorRow) continue;

    for (const product of vendor.products) {
      const { rows: [productRow] } = await client.query<{ id: string }>(
        `SELECT id FROM catalog_entries WHERE type_id = 'product' AND name = $1`,
        [product.name],
      );
      if (!productRow) continue;

      // vendor makes product
      await client.query(
        `INSERT INTO catalog_entry_associations (id, source_entry_id, target_entry_id, association_type_id)
         VALUES ($1, $2, $3, 'makes')
         ON CONFLICT (source_entry_id, target_entry_id, association_type_id) DO NOTHING`,
        [randomUUID(), vendorRow.id, productRow.id],
      );

      // product uses_technology (look up by pretty name or alias)
      for (const tech of product.techs) {
        const prettyTechName = TECH_MAP[tech]?.name ?? tech;
        const { rows: [techRow] } = await client.query<{ id: string }>(
          `SELECT id FROM catalog_entries WHERE type_id = 'technology' AND name = $1`,
          [prettyTechName],
        );
        if (!techRow) continue;

        await client.query(
          `INSERT INTO catalog_entry_associations (id, source_entry_id, target_entry_id, association_type_id)
           VALUES ($1, $2, $3, 'uses_technology')
           ON CONFLICT (source_entry_id, target_entry_id, association_type_id) DO NOTHING`,
          [randomUUID(), productRow.id, techRow.id],
        );
      }
    }
  }

  const { rows: [techCount] }    = await client.query<{ c: string }>(`SELECT COUNT(*) c FROM catalog_entries WHERE type_id = 'technology'`);
  const { rows: [vendorCount] }  = await client.query<{ c: string }>(`SELECT COUNT(*) c FROM catalog_entries WHERE type_id = 'vendor'`);
  const { rows: [productCount] } = await client.query<{ c: string }>(`SELECT COUNT(*) c FROM catalog_entries WHERE type_id = 'product'`);

  console.log(`  ✓ ${techCount.c} technologies, ${vendorCount.c} vendors, ${productCount.c} products`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const client = await pool.connect();
  try {
    await seedStates(client);
    await seedStateMetadata(client);
    await seedTribes(client);
    await seedPlaces(client);
    await seedCounties(client);
    await seedCatalog(client);
    console.log("\nSeed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
