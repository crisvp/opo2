# Browse Locations Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the `/locations` index view with a US SVG map, tabbed interface (States / Tribal Nations), collapsed list cards, PrimeVue tooltips, LSAD code removal, and Connecticut places fix.

**Architecture:** The `/locations` route becomes a layout with two child routes (`/locations/states`, `/locations/tribes`). The server's states endpoint gains a `documentCount` field. The SVG map uses `@svg-maps/usa` paths with PrimeVue `v-tooltip` directives (registered globally in `main.ts`). The places endpoint is fixed to return all entries for a state (removing the 7-digit GEOID-only filter).

**Tech Stack:** Vue 3 + `<script setup>`, PrimeVue v4 (Tooltip directive, Panel), TanStack Query, `@svg-maps/usa` (SVG map paths), Tailwind CSS v4, Fastify + Kysely (server), Vitest (tests)

---

## Task 1: Register PrimeVue Tooltip directive globally

**Files:**
- Modify: `packages/web/src/main.ts`

**Step 1: Add the import and directive registration**

In `packages/web/src/main.ts`, add after the existing PrimeVue imports:

```typescript
import Tooltip from 'primevue/tooltip';
```

And after `app.use(ToastService);`, add:

```typescript
app.directive('tooltip', Tooltip);
```

**Step 2: Verify the sidebar tooltip warning is gone**

Start the dev server and confirm the console no longer shows:
```
[Vue warn]: Failed to resolve directive: tooltip
```

**Step 3: Commit**

```bash
git add packages/web/src/main.ts
git commit -m "fix(web): register PrimeVue Tooltip directive globally"
```

---

## Task 2: Fix `StateBrowseView` — remove LSAD code display

**Files:**
- Modify: `packages/web/src/views/locations/StateBrowseView.vue`

The current template renders `({{ place.lsad }})` which shows numeric codes like `(43)` and `(57)`. Remove that span entirely. The place `name` is already descriptive.

Also remove the GEOID display on the right side (`{{ place.geoid }}`).

**Step 1: Edit the template**

Replace the `<li>` body content (the inner `<div>` with name + lsad span, and the geoid span) with just the name:

```html
<RouterLink
  :to="`/locations/places/${place.geoid}`"
  class="flex items-center py-3 hover:bg-sunken px-2 rounded transition-colors"
>
  <span class="font-medium text-primary">{{ place.name }}</span>
</RouterLink>
```

**Step 2: Commit**

```bash
git add packages/web/src/views/locations/StateBrowseView.vue
git commit -m "fix(web): remove LSAD code display from place list"
```

---

## Task 3: Fix `formatPlaceDisplayName` in shared types

**Files:**
- Modify: `packages/shared/src/types/location.ts`

The `formatPlaceDisplayName` helper still appends LSAD as a parenthetical. This function is used in `LocationSelector.vue` and other autocomplete components. Update it to drop the LSAD suffix:

```typescript
export function formatPlaceDisplayName(place: Place): string {
  return `${place.name}, ${place.usps}`;
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/types/location.ts
git commit -m "fix(shared): remove LSAD parenthetical from formatPlaceDisplayName"
```

---

## Task 4: Fix Connecticut places — replace incomplete gazetteer and reseed

**Files:**
- Already replaced: `packages/server/data/2025_Gaz_place_national.txt` (copied from `reference/data/` — complete 52-state, 32,351-entry version)

**Context:** The places gazetteer was missing 6 states (CT, CA, AR, CO, DC, DE and more — only 46 of 52). The complete file from `reference/data/` has been copied over. The DB needs reseeding.

**Step 1: Reseed the database**

```bash
pnpm --filter server seed
```

Expected: CT places seeded (215 entries).

**Step 2: Verify CT has places in DB**

```bash
docker exec opo-postgres psql -U opo_admin -d opo -c "SELECT count(*) FROM places WHERE usps='CT' AND length(geoid)=7;"
```

Expected: count is 215 (or similar, >0).

**Step 3: Write the test**

Add to the `GET /api/locations/states/:usps/places` describe block in `packages/server/tests/routes/locations.test.ts`:

```typescript
it("returns places for Connecticut", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/locations/states/CT/places",
  });

  expect(response.statusCode).toBe(200);
  const body = response.json() as { success: boolean; data: unknown[] };
  expect(body.success).toBe(true);
  expect(body.data.length).toBeGreaterThan(0);
});
```

**Step 4: Run the test**

```bash
pnpm --filter server test -- --reporter=verbose tests/routes/locations.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/data/2025_Gaz_place_national.txt packages/server/tests/routes/locations.test.ts
git commit -m "fix(data): replace incomplete places gazetteer with complete 52-state version; add CT test"
```

---

## Task 5: Add `documentCount` to the states endpoint

**Files:**
- Modify: `packages/server/src/routes/locations/states.ts`
- Modify: `packages/shared/src/types/location.ts`
- Modify: `packages/web/src/api/queries/locations.ts`
- Modify: `packages/server/tests/routes/locations.test.ts`

**Step 1: Write the failing test**

Add to the `GET /api/locations/states` describe block in `packages/server/tests/routes/locations.test.ts`:

```typescript
it("items include documentCount field", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/locations/states",
  });

  const body = response.json() as { success: boolean; data: Array<Record<string, unknown>> };
  if (body.data.length > 0) {
    const first = body.data[0];
    expect(typeof first.documentCount).toBe("number");
  }
});
```

**Step 2: Run to confirm fail**

```bash
pnpm --filter server test -- --reporter=verbose tests/routes/locations.test.ts
```

Expected: FAIL — `documentCount` is `undefined`.

**Step 3: Update the server route**

In `packages/server/src/routes/locations/states.ts`, replace the current handler with one that LEFT JOINs a document count:

```typescript
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/states",
    { schema: {} },
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("states")
        .leftJoin(
          fastify.db
            .selectFrom("documents")
            .select([
              "state_usps",
              fastify.db.fn.countAll<number>().as("doc_count"),
            ])
            .where("state", "=", "approved")
            .groupBy("state_usps")
            .as("dc"),
          "dc.state_usps",
          "states.usps",
        )
        .select([
          "states.usps",
          "states.name",
          "states.is_territory",
          "dc.doc_count",
        ])
        .orderBy("states.name", "asc")
        .execute();

      return {
        success: true,
        data: rows.map((r) => ({
          usps: r.usps as string,
          name: r.name as string,
          isTerritory: r.is_territory as boolean,
          documentCount: Number(r.doc_count ?? 0),
        })),
      };
    },
  );
};

export default plugin;
```

**Step 4: Update the shared `State` interface**

In `packages/shared/src/types/location.ts`, add `documentCount` to the `State` interface:

```typescript
export interface State {
  usps: string;
  name: string;
  isTerritory: boolean;
  documentCount: number;
}
```

**Step 5: Run the test to confirm it passes**

```bash
pnpm --filter server test -- --reporter=verbose tests/routes/locations.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/server/src/routes/locations/states.ts packages/shared/src/types/location.ts packages/server/tests/routes/locations.test.ts
git commit -m "feat(server): add documentCount to states endpoint"
```

---

## Task 6: Install `@svg-maps/usa`

**Files:**
- Modify: `packages/web/package.json` (via pnpm)

**Note on license:** `@svg-maps/usa` is CC-BY-NC-4.0 (non-commercial). If this project is open source / non-commercial, it's fine. If commercial use is anticipated, consider using `us-atlas` (ISC/public domain) with inline SVG paths instead. For now the plan uses `@svg-maps/usa` — flag with the team if licensing is a concern.

**Step 1: Install the package**

```bash
cd /Users/hcvp/opo2
pnpm --filter web add @svg-maps/usa svg-maps
```

(`svg-maps` provides the `SvgMap` Vue component and types; `@svg-maps/usa` provides the map data.)

**Step 2: Verify it installed**

```bash
ls packages/web/node_modules/@svg-maps/
```

Expected: `usa` directory present.

**Step 3: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @svg-maps/usa and svg-maps dependencies"
```

---

## Task 7: Create `UsaStateMap.vue` component

**Files:**
- Create: `packages/web/src/components/locations/UsaStateMap.vue`

This component renders an interactive SVG map of the US states. It:
- Accepts `states` as a prop (array of `State` with `documentCount`)
- Uses the `@svg-maps/usa` path data
- Applies `v-tooltip` on each `<path>` showing `"StateName\nN documents"`
- Emits `select(usps: string)` on click
- Colors paths by document count (more docs = deeper primary color)
- Uses only semantic color tokens (no primitive Tailwind color utilities)

**Step 1: Create the component**

```vue
<script setup lang="ts">
import { computed } from "vue";
import USA from "@svg-maps/usa";
import type { State } from "@opo/shared";

const props = defineProps<{
  states: State[];
}>();

const emit = defineEmits<{
  select: [usps: string];
}>();

const stateMap = computed(() => {
  const m = new Map<string, State>();
  for (const s of props.states) {
    // @svg-maps/usa uses lowercase state names as IDs; match by usps
    m.set(s.usps.toLowerCase(), s);
  }
  return m;
});

// Build a usps -> State lookup keyed by the svg map's id field
// @svg-maps/usa location ids are lowercase state abbreviations
const byId = computed(() => {
  const m = new Map<string, State>();
  for (const s of props.states) {
    m.set(s.usps.toLowerCase(), s);
  }
  return m;
});

const maxCount = computed(() => {
  return Math.max(1, ...props.states.map((s) => s.documentCount));
});

function opacityForState(id: string): number {
  const state = byId.value.get(id);
  if (!state || state.documentCount === 0) return 0.08;
  return 0.15 + (state.documentCount / maxCount.value) * 0.75;
}

function tooltipText(id: string): string {
  const state = byId.value.get(id);
  if (!state) return "";
  const count = state.documentCount;
  return `${state.name}\n${count} document${count !== 1 ? "s" : ""}`;
}

function handleClick(id: string) {
  const state = byId.value.get(id);
  if (state) emit("select", state.usps);
}

const mapData = USA;
</script>

<template>
  <div class="w-full overflow-hidden rounded-lg border border-default bg-surface p-2">
    <svg
      :viewBox="mapData.viewBox"
      xmlns="http://www.w3.org/2000/svg"
      class="w-full h-auto"
      aria-label="Map of US states"
    >
      <path
        v-for="location in mapData.locations"
        :key="location.id"
        :id="location.id"
        :d="location.path"
        :style="{ fillOpacity: opacityForState(location.id) }"
        v-tooltip.top="tooltipText(location.id)"
        class="fill-primary stroke-surface stroke-[0.5] cursor-pointer transition-[fill-opacity] duration-150 hover:fill-opacity-80"
        @click="handleClick(location.id)"
      />
    </svg>
  </div>
</template>
```

**Note:** `@svg-maps/usa` location IDs are lowercase state abbreviations (e.g. `"ca"`, `"tx"`). Verify this after install — if they differ (e.g. full state name or FIPS), adjust the `byId` map key accordingly.

**Step 2: Check the actual IDs used by the library**

```bash
node -e "const USA = require('./packages/web/node_modules/@svg-maps/usa'); console.log(USA.locations.slice(0,5).map(l => l.id))"
```

Adjust the `byId` computed if needed (e.g. if IDs are full state names, map by `name.toLowerCase()` instead).

**Step 3: Commit**

```bash
git add packages/web/src/components/locations/UsaStateMap.vue
git commit -m "feat(web): add UsaStateMap component with PrimeVue tooltips"
```

---

## Task 8: Create router layout and tab views

**Files:**
- Create: `packages/web/src/views/locations/LocationsLayoutView.vue`
- Create: `packages/web/src/views/locations/StatesTabView.vue`
- Create: `packages/web/src/views/locations/TribesTabView.vue`
- Modify: `packages/web/src/router/index.ts`

### Step 1: Create `LocationsLayoutView.vue`

This is the parent layout with the tab bar. It contains a `<RouterView>` for the active tab.

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const tabs = [
  { label: "States", to: "/locations/states" },
  { label: "Tribal Nations", to: "/locations/tribes" },
];

const activeIndex = computed(() =>
  tabs.findIndex((t) => route.path.startsWith(t.to))
);

function navigate(index: number) {
  router.push(tabs[index].to);
}
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-primary mb-6">Locations</h1>
    <div class="flex gap-1 mb-6 border-b border-default">
      <button
        v-for="(tab, i) in tabs"
        :key="tab.to"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
          activeIndex === i
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-primary',
        ]"
        @click="navigate(i)"
      >
        {{ tab.label }}
      </button>
    </div>
    <RouterView />
  </div>
</template>
```

### Step 2: Create `StatesTabView.vue`

This view has: the SVG map at top, then a collapsed Panel for states, then a collapsed Panel for territories.

```vue
<script setup lang="ts">
import { computed } from "vue";
import Panel from "primevue/panel";
import { useStateList } from "../../api/queries/locations";
import UsaStateMap from "../../components/locations/UsaStateMap.vue";
import { useRouter } from "vue-router";

const { data: states, isLoading, isError } = useStateList();
const router = useRouter();

const mainStates = computed(() => states.value?.filter((s) => !s.isTerritory) ?? []);
const territories = computed(() => states.value?.filter((s) => s.isTerritory) ?? []);

const totalStateDocs = computed(() =>
  mainStates.value.reduce((sum, s) => sum + s.documentCount, 0)
);
const totalTerritoryDocs = computed(() =>
  territories.value.reduce((sum, s) => sum + s.documentCount, 0)
);

function onMapSelect(usps: string) {
  router.push(`/locations/states/${usps}`);
}
</script>

<template>
  <div v-if="isLoading" class="text-muted">Loading states…</div>
  <div v-else-if="isError" class="text-critical">Failed to load states.</div>
  <div v-else class="space-y-6">
    <!-- SVG Map -->
    <UsaStateMap
      v-if="mainStates.length"
      :states="mainStates"
      @select="onMapSelect"
    />

    <!-- States list (collapsed by default) -->
    <Panel :collapsed="true" toggleable>
      <template #header>
        <span class="font-medium text-primary">
          States
          <span class="text-muted font-normal text-sm ml-2">{{ totalStateDocs.toLocaleString() }} documents</span>
        </span>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
        <RouterLink
          v-for="state in mainStates"
          :key="state.usps"
          :to="`/locations/states/${state.usps}`"
          class="block rounded-lg border border-default p-3 hover:bg-sunken transition-colors text-sm font-medium text-primary"
        >
          <div class="font-bold text-lg">{{ state.usps }}</div>
          <div class="text-muted text-xs">{{ state.name }}</div>
          <div class="text-muted text-xs mt-1">{{ state.documentCount }} docs</div>
        </RouterLink>
      </div>
    </Panel>

    <!-- Territories (collapsed by default) -->
    <Panel :collapsed="true" toggleable>
      <template #header>
        <span class="font-medium text-primary">
          US Territories
          <span class="text-muted font-normal text-sm ml-2">{{ totalTerritoryDocs.toLocaleString() }} documents</span>
        </span>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
        <RouterLink
          v-for="territory in territories"
          :key="territory.usps"
          :to="`/locations/states/${territory.usps}`"
          class="block rounded-lg border border-default p-3 hover:bg-sunken transition-colors text-sm font-medium text-primary"
        >
          <div class="font-bold text-lg">{{ territory.usps }}</div>
          <div class="text-muted text-xs">{{ territory.name }}</div>
          <div class="text-muted text-xs mt-1">{{ territory.documentCount }} docs</div>
        </RouterLink>
      </div>
    </Panel>
  </div>
</template>
```

### Step 3: Create `TribesTabView.vue`

Placeholder: shows tribes list with a note that a map view is coming.

```vue
<script setup lang="ts">
import { useTribeList } from "../../api/queries/locations";

const { data: tribes, isLoading, isError } = useTribeList();
</script>

<template>
  <div>
    <div v-if="isLoading" class="text-muted">Loading tribal nations…</div>
    <div v-else-if="isError" class="text-critical">Failed to load tribal nations.</div>
    <div v-else class="space-y-4">
      <ul class="divide-y divide-default">
        <li v-for="tribe in tribes" :key="tribe.id">
          <RouterLink
            :to="`/locations/tribes/${tribe.id}`"
            class="flex items-center py-3 px-2 hover:bg-sunken rounded transition-colors"
          >
            <span class="font-medium text-primary">{{ tribe.name }}</span>
            <span v-if="tribe.isAlaskaNative" class="ml-2 text-xs text-muted">(Alaska Native)</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
```

### Step 4: Update the router

In `packages/web/src/router/index.ts`, replace the flat `/locations` route with nested children:

```typescript
// OLD — remove:
{
  path: "/locations",
  name: "locations",
  component: () => import("../views/locations/LocationsIndexView.vue"),
},

// NEW — replace with:
{
  path: "/locations",
  component: () => import("../views/locations/LocationsLayoutView.vue"),
  children: [
    {
      path: "",
      redirect: "/locations/states",
    },
    {
      path: "states",
      name: "locations-states",
      component: () => import("../views/locations/StatesTabView.vue"),
    },
    {
      path: "tribes",
      name: "locations-tribes",
      component: () => import("../views/locations/TribesTabView.vue"),
    },
  ],
},
```

**Important:** The existing child routes `states/:usps`, `places/:geoid`, `tribes/:tribeId` must remain as **sibling** top-level routes (not nested under the layout), since they have their own full-page views. Verify the router still has them at the top level.

**Step 5: Verify routing in dev server**

- Navigate to `/locations` → should redirect to `/locations/states` and show map + collapsed panels
- Navigate to `/locations/tribes` → should show tribes list
- Navigate to `/locations/states/CA` → should still show `StateBrowseView`
- Navigate back → tabs should be active based on current route

**Step 6: Commit**

```bash
git add packages/web/src/views/locations/LocationsLayoutView.vue
git add packages/web/src/views/locations/StatesTabView.vue
git add packages/web/src/views/locations/TribesTabView.vue
git add packages/web/src/router/index.ts
git commit -m "feat(web): tabbed locations layout with States and Tribal Nations tabs"
```

---

## Task 9: Verify SVG map IDs and fix if needed

After Task 7 and 8 are complete, visually verify the map in the browser:

**Step 1: Open browser to `/locations/states`**

Check if states on the map are colored correctly (some darker based on doc count) and tooltips appear on hover.

**Step 2: If states aren't highlighted, check the IDs**

```bash
node -e "
const USA = require('./packages/web/node_modules/@svg-maps/usa');
console.log('viewBox:', USA.viewBox);
console.log('Sample IDs:', USA.locations.slice(0, 10).map(l => ({id: l.id, name: l.name})));
"
```

The IDs should be USPS lowercase codes (e.g. `ca`, `tx`). If they're something else (e.g. full names), update the `byId` computed in `UsaStateMap.vue` to match.

**Step 3: Fix tooltip newlines if needed**

PrimeVue tooltip text uses HTML by default. To show newlines, either:
- Use `<br>` in the tooltip string (if HTML is enabled)
- Or format as `"StateName — N documents"` on one line

Update `tooltipText` in `UsaStateMap.vue`:

```typescript
function tooltipText(id: string): string {
  const state = byId.value.get(id);
  if (!state) return "";
  const count = state.documentCount;
  return `${state.name} — ${count} document${count !== 1 ? "s" : ""}`;
}
```

**Step 4: Commit any fixes**

```bash
git add packages/web/src/components/locations/UsaStateMap.vue
git commit -m "fix(web): correct SVG map state ID mapping and tooltip format"
```

---

## Task 10: Remove `LocationsIndexView.vue` (dead code cleanup)

**Files:**
- Delete: `packages/web/src/views/locations/LocationsIndexView.vue`

Once `StatesTabView.vue` replaces it, the old view is dead code.

**Step 1: Delete the file**

```bash
rm packages/web/src/views/locations/LocationsIndexView.vue
```

**Step 2: Confirm no imports remain**

```bash
grep -r "LocationsIndexView" packages/web/src/
```

Expected: no results.

**Step 3: Commit**

```bash
git add -u packages/web/src/views/locations/LocationsIndexView.vue
git commit -m "chore(web): remove LocationsIndexView replaced by StatesTabView"
```

---

## Task 11: Final verification

**Step 1: Run all server tests**

```bash
pnpm --filter server test
```

Expected: all pass, no regressions.

**Step 2: Run tsc type check**

```bash
pnpm --filter web exec vue-tsc --noEmit
pnpm --filter shared exec tsc --noEmit
```

Expected: no type errors.

**Step 3: Check browser for regressions**

Manually verify:
- `/locations` → redirects to `/locations/states`
- Map renders all states, tooltip shows name + doc count on hover
- Clicking a state navigates to `/locations/states/:usps`
- States panel is collapsed by default, expands on click
- Territories panel is collapsed by default, expands on click
- `/locations/tribes` tab shows tribes list
- `/locations/states/CA` still shows CA places (with CT showing planning regions)
- No LSAD codes like `(43)` in place names
- No Vue warnings about unresolved tooltip directive
