# Frontend Design Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all semantic token violations and UX inconsistencies across the web frontend, restoring design system compliance in 22 files.

**Architecture:** Pure frontend changes only — no backend, no shared schema changes, no new routes. All changes are mechanical token replacements (P0), component replacements (P1), and a dead code removal (P2). No tests are required for these changes (token substitutions and PrimeVue swaps are not business logic); verification is visual + linter.

**Tech Stack:** Vue 3 Composition API, PrimeVue v4, Tailwind CSS v4 with semantic tokens defined in `packages/web/src/styles/main.css`.

---

## Valid Token Reference (memorize this)

| Purpose | Valid tokens |
|---|---|
| Text | `text-primary`, `text-secondary`, `text-muted`, `text-inverted`, `text-critical`, `text-success`, `text-warning`, `text-info`, `text-link`, `text-accent` |
| Backgrounds | `bg-surface`, `bg-surface-subtle`, `bg-elevated`, `bg-sunken`, `bg-critical-subtle`, `bg-success-subtle`, `bg-warning-subtle`, `bg-info-subtle`, `bg-interactive`, `bg-interactive-subtle`, `bg-accent-subtle` |
| Borders | `border-default`, `border-subtle`, `border-strong`, `border-focus` |
| Rings | `ring-focus` (NOT `ring-primary`) |

---

## Task 1: Fix `stateBadgeClass` in DocumentCard.vue

**Files:**
- Modify: `packages/web/src/components/documents/DocumentCard.vue`

**Step 1: Read the file**

```bash
# View the stateBadgeClass function at lines 18–29
```

**Step 2: Replace `stateBadgeClass`**

Find the function (lines 18–29) and replace it with:
```typescript
function stateBadgeClass(state: string): string {
  const map: Record<string, string> = {
    approved: "bg-success-subtle text-success",
    submitted: "bg-info-subtle text-info",
    processing: "bg-warning-subtle text-warning",
    draft: "bg-surface-subtle text-secondary",
    moderator_review: "bg-accent-subtle text-accent",
    user_review: "bg-warning-subtle text-warning",
    rejected: "bg-critical-subtle text-critical",
    processing_failed: "bg-critical-subtle text-critical",
  };
  return map[state] ?? "bg-surface-subtle text-muted";
}
```

**Step 3: Fix `bg-surface-primary` at line 35**

Replace: `bg-surface-primary` → `bg-elevated`

**Step 4: Verify**

```bash
pnpm --filter web typecheck 2>&1 | head -20
```
Expected: No new TypeScript errors.

**Step 5: Commit**

```bash
git add packages/web/src/components/documents/DocumentCard.vue
git commit -m "fix(web): fix stateBadgeClass tokens and bg-surface-primary in DocumentCard"
```

---

## Task 2: Fix `stateBadgeClass` in DocumentDetailView.vue

**Files:**
- Modify: `packages/web/src/views/DocumentDetailView.vue`

**Step 1: Read the file, find `stateBadgeClass` (lines 26–37)**

**Step 2: Replace with corrected version**

Same function body as Task 1 (full state map with semantic tokens).

**Step 3: Commit**

```bash
git add packages/web/src/views/DocumentDetailView.vue
git commit -m "fix(web): fix stateBadgeClass tokens in DocumentDetailView"
```

---

## Task 3: Fix `stateBadgeClass` in MyUploadsView.vue

**Files:**
- Modify: `packages/web/src/views/MyUploadsView.vue`

**Step 1: Read the file, find `stateBadgeClass` (lines 47–59)**

**Step 2: Replace with corrected version**

Same function body as Task 1.

**Step 3: Fix `bg-surface-primary` at line 103**

Replace: `bg-surface-primary` → `bg-elevated`

**Step 4: Commit**

```bash
git add packages/web/src/views/MyUploadsView.vue
git commit -m "fix(web): fix stateBadgeClass tokens and bg-surface-primary in MyUploadsView"
```

---

## Task 4: Fix `statusClass` in ImportJobStatus.vue

**Files:**
- Modify: `packages/web/src/components/documents/ImportJobStatus.vue`

**Step 1: Read the file**

**Step 2: Replace `statusClass` computed (lines 12–20)**

```typescript
const statusClass = computed(() => {
  const map: Record<string, string> = {
    pending: "bg-warning-subtle text-warning",
    processing: "bg-info-subtle text-info",
    completed: "bg-success-subtle text-success",
    failed: "bg-critical-subtle text-critical",
  };
  return map[data.value?.status ?? ""] ?? "bg-surface-subtle text-muted";
});
```

**Step 3: Fix `bg-surface-primary` at line 25**

Replace: `bg-surface-primary` → `bg-elevated`

**Step 4: Commit**

```bash
git add packages/web/src/components/documents/ImportJobStatus.vue
git commit -m "fix(web): fix statusClass tokens and bg-surface-primary in ImportJobStatus"
```

---

## Task 5: Fix primitive badge token in AiReviewView.vue

**Files:**
- Modify: `packages/web/src/views/AiReviewView.vue`

**Step 1: Read the file**

**Step 2: Find line 73 and replace**

```
Before: bg-purple-100 text-purple-800
After:  bg-accent-subtle text-accent
```

Use the `replace_content` tool with literal mode or read+edit.

**Step 3: Commit**

```bash
git add packages/web/src/views/AiReviewView.vue
git commit -m "fix(web): replace primitive badge color with semantic tokens in AiReviewView"
```

---

## Task 6: Fix `bg-surface-primary` in DocumentCloudResultCard.vue

**Files:**
- Modify: `packages/web/src/components/documents/DocumentCloudResultCard.vue`

**Step 1: Read the file**

**Step 2: Replace at line 24**

`bg-surface-primary` → `bg-elevated`

**Step 3: Commit**

```bash
git add packages/web/src/components/documents/DocumentCloudResultCard.vue
git commit -m "fix(web): replace bg-surface-primary with bg-elevated in DocumentCloudResultCard"
```

---

## Task 7: Fix `bg-surface-primary` and `focus:ring-primary` in ModerationView.vue

**Files:**
- Modify: `packages/web/src/views/ModerationView.vue`

**Step 1: Read the file**

**Step 2: Replace all occurrences**

- Lines 85, 169: `bg-surface-primary` → `bg-elevated`
- Line 176: `focus:ring-primary` → `focus:ring-focus`

**Step 3: Commit**

```bash
git add packages/web/src/views/ModerationView.vue
git commit -m "fix(web): fix bg-surface-primary and focus:ring-primary in ModerationView"
```

---

## Task 8: Fix `bg-surface-primary` and `focus:ring-primary` in SearchInput.vue

**Files:**
- Modify: `packages/web/src/components/shared/SearchInput.vue`

**Step 1: Read the file**

**Step 2: At line 45, replace both on the same line (or nearby)**

- `bg-surface-primary` → `bg-elevated`
- `focus:ring-primary` → `focus:ring-focus`

**Step 3: Commit**

```bash
git add packages/web/src/components/shared/SearchInput.vue
git commit -m "fix(web): fix bg-surface-primary and focus:ring-primary in SearchInput"
```

---

## Task 9: Fix `bg-surface-sunken`/`bg-surface-elevated` in auth views (batch)

**Files:**
- Modify: `packages/web/src/views/LoginView.vue`
- Modify: `packages/web/src/views/RegisterView.vue`
- Modify: `packages/web/src/views/ForgotPasswordView.vue`
- Modify: `packages/web/src/views/ResetPasswordView.vue`
- Modify: `packages/web/src/views/TwoFactorView.vue`
- Modify: `packages/web/src/views/NotFoundView.vue`

**Step 1: For each file, read it to locate the exact lines**

**Step 2: Apply replacements**

Pattern for each auth view (LoginView, RegisterView, ForgotPasswordView, ResetPasswordView, TwoFactorView):
- `bg-surface-sunken` → `bg-sunken`
- `bg-surface-elevated` → `bg-elevated`

For NotFoundView (line 9, outer div only):
- `bg-surface-sunken` → `bg-sunken`

**Step 3: Commit**

```bash
git add packages/web/src/views/LoginView.vue \
        packages/web/src/views/RegisterView.vue \
        packages/web/src/views/ForgotPasswordView.vue \
        packages/web/src/views/ResetPasswordView.vue \
        packages/web/src/views/TwoFactorView.vue \
        packages/web/src/views/NotFoundView.vue
git commit -m "fix(web): replace bg-surface-sunken/elevated with canonical tokens in auth views"
```

---

## Task 10: Fix all token violations in SecuritySettingsView.vue

**Files:**
- Modify: `packages/web/src/views/SecuritySettingsView.vue`

**Step 1: Read the file**

**Step 2: Apply all replacements**

- Lines 138, 193: `bg-surface-elevated` → `bg-elevated`
- Line 204: `bg-surface-sunken` → `bg-sunken`
- Lines 168, 210, 219: `bg-surface-base` → `bg-sunken`

**Step 3: Commit**

```bash
git add packages/web/src/views/SecuritySettingsView.vue
git commit -m "fix(web): fix all invalid bg tokens in SecuritySettingsView"
```

---

## Task 11: Fix `focus:ring-primary` in DocumentEditView.vue

**Files:**
- Modify: `packages/web/src/views/DocumentEditView.vue`

**Step 1: Read the file**

**Step 2: Replace at lines 138, 152, 166, 180**

`focus:ring-primary` → `focus:ring-focus` (replace all occurrences)

**Step 3: Commit**

```bash
git add packages/web/src/views/DocumentEditView.vue
git commit -m "fix(web): replace focus:ring-primary with ring-focus in DocumentEditView"
```

---

## Task 12: Fix `focus:ring-primary` and yellow banner in DocumentCloudSearchView.vue

**Files:**
- Modify: `packages/web/src/views/DocumentCloudSearchView.vue`

**Step 1: Read the file**

**Step 2: Replace at lines 121, 132**

`focus:ring-primary` → `focus:ring-focus`

**Step 3: Fix yellow warning banner at line 105**

```
Before: border-yellow-300 bg-yellow-50 ... text-yellow-800
After:  border-default bg-warning-subtle ... text-warning
```

Full replacement:
```
class="rounded-lg border border-default bg-warning-subtle px-4 py-3 text-sm text-warning"
```

**Step 4: Commit**

```bash
git add packages/web/src/views/DocumentCloudSearchView.vue
git commit -m "fix(web): fix ring-primary and yellow banner tokens in DocumentCloudSearchView"
```

---

## Task 13: Fix dark mode toggle in AppMobileHeader.vue

**Files:**
- Modify: `packages/web/src/components/layout/AppMobileHeader.vue`

**Step 1: Read the file**

**Step 2: Add `isDark` reactive state to `<script setup>`**

Add after the existing imports:
```typescript
import { ref } from "vue";

const isDark = ref(document.documentElement.classList.contains("dark"));

function toggleDarkMode() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem("theme", isDark.value ? "dark" : "light");
}
```

Note: If `ref` is already imported, don't duplicate the import. If there's already a `toggleDarkMode` function, replace it.

**Step 3: Update the Button in the template**

Find the dark mode Button element and change it to:
```html
<Button
  :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
  severity="secondary"
  text
  rounded
  @click="toggleDarkMode"
  :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
/>
```

**Step 4: Commit**

```bash
git add packages/web/src/components/layout/AppMobileHeader.vue
git commit -m "fix(web): make mobile dark mode toggle track and react to current theme state"
```

---

## Task 14: Implement EmptyState component

**Files:**
- Modify: `packages/web/src/components/shared/EmptyState.vue` (currently a stub)

**Step 1: Replace the stub with the full implementation**

```vue
<script setup lang="ts">
defineProps<{
  icon?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
    <i v-if="icon" :class="['pi', icon, 'text-4xl text-muted']" aria-hidden="true" />
    <p class="text-base font-medium text-primary">{{ title }}</p>
    <p v-if="description" class="text-sm text-muted max-w-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
```

**Step 2: Commit**

```bash
git add packages/web/src/components/shared/EmptyState.vue
git commit -m "feat(web): implement EmptyState component from stub"
```

---

## Task 15: Update BrowseView — EmptyState, PrimeVue Select, and Paginator

**Files:**
- Modify: `packages/web/src/views/BrowseView.vue`

**Step 1: Read the file** (already read above, but re-read for current state before editing)

**Step 2: Add imports**

Add to the `<script setup>` imports block:
```typescript
import Select from "primevue/select";
import Button from "primevue/button";
import Paginator from "primevue/paginator";
import EmptyState from "../components/shared/EmptyState.vue";
```

**Step 3: Add `onPageChange` handler**

After `function goToPage`, add:
```typescript
function onPageChange(event: { page: number; rows: number }) {
  filtersStore.page = event.page + 1; // Paginator is 0-indexed; store is 1-indexed
  filtersStore.pageSize = event.rows;
}
```

(The old `goToPage` function can be removed once the Paginator replaces the manual button loop.)

**Step 4: Replace the filter dropdowns in the template**

Remove the two `<select>` elements and the `<button>Clear filters</button>`. Replace with:

```html
<Select
  v-model="filtersStore.governmentLevel"
  :options="[
    { label: 'Federal', value: 'federal' },
    { label: 'State', value: 'state' },
    { label: 'Place', value: 'place' },
    { label: 'Tribal', value: 'tribal' },
  ]"
  option-label="label"
  option-value="value"
  placeholder="All levels"
  show-clear
/>

<Select
  v-model="filtersStore.stateUsps"
  :options="[
    { label: 'Alabama', value: 'AL' }, { label: 'Alaska', value: 'AK' },
    { label: 'Arizona', value: 'AZ' }, { label: 'Arkansas', value: 'AR' },
    { label: 'California', value: 'CA' }, { label: 'Colorado', value: 'CO' },
    { label: 'Connecticut', value: 'CT' }, { label: 'Delaware', value: 'DE' },
    { label: 'Florida', value: 'FL' }, { label: 'Georgia', value: 'GA' },
    { label: 'Hawaii', value: 'HI' }, { label: 'Idaho', value: 'ID' },
    { label: 'Illinois', value: 'IL' }, { label: 'Indiana', value: 'IN' },
    { label: 'Iowa', value: 'IA' }, { label: 'Kansas', value: 'KS' },
    { label: 'Kentucky', value: 'KY' }, { label: 'Louisiana', value: 'LA' },
    { label: 'Maine', value: 'ME' }, { label: 'Maryland', value: 'MD' },
    { label: 'Massachusetts', value: 'MA' }, { label: 'Michigan', value: 'MI' },
    { label: 'Minnesota', value: 'MN' }, { label: 'Mississippi', value: 'MS' },
    { label: 'Missouri', value: 'MO' }, { label: 'Montana', value: 'MT' },
    { label: 'Nebraska', value: 'NE' }, { label: 'Nevada', value: 'NV' },
    { label: 'New Hampshire', value: 'NH' }, { label: 'New Jersey', value: 'NJ' },
    { label: 'New Mexico', value: 'NM' }, { label: 'New York', value: 'NY' },
    { label: 'North Carolina', value: 'NC' }, { label: 'North Dakota', value: 'ND' },
    { label: 'Ohio', value: 'OH' }, { label: 'Oklahoma', value: 'OK' },
    { label: 'Oregon', value: 'OR' }, { label: 'Pennsylvania', value: 'PA' },
    { label: 'Rhode Island', value: 'RI' }, { label: 'South Carolina', value: 'SC' },
    { label: 'South Dakota', value: 'SD' }, { label: 'Tennessee', value: 'TN' },
    { label: 'Texas', value: 'TX' }, { label: 'Utah', value: 'UT' },
    { label: 'Vermont', value: 'VT' }, { label: 'Virginia', value: 'VA' },
    { label: 'Washington', value: 'WA' }, { label: 'West Virginia', value: 'WV' },
    { label: 'Wisconsin', value: 'WI' }, { label: 'Wyoming', value: 'WY' },
  ]"
  option-label="label"
  option-value="value"
  placeholder="All states"
  show-clear
  filter
/>

<Button
  v-if="filtersStore.search || filtersStore.governmentLevel || filtersStore.stateUsps"
  label="Clear filters"
  severity="secondary"
  @click="filtersStore.reset()"
/>
```

**Step 5: Replace the Empty state div**

Replace:
```html
<div
  v-else-if="items.length === 0"
  class="text-center py-12 text-muted"
>
  No documents found.
</div>
```

With:
```html
<EmptyState
  v-else-if="items.length === 0"
  icon="pi-search"
  title="No documents found"
  description="Try adjusting your search filters."
/>
```

**Step 6: Replace the manual pagination loop**

Remove the entire `<div v-if="totalPages > 1" ...>` button loop. Replace with:
```html
<Paginator
  v-if="total > filtersStore.pageSize"
  :rows="filtersStore.pageSize"
  :total-records="total"
  :first="(filtersStore.page - 1) * filtersStore.pageSize"
  class="mt-8"
  @page="onPageChange"
/>
```

Also remove the now-unused `goToPage` function and `totalPages` computed.

**Step 7: Run typecheck**

```bash
pnpm --filter web typecheck 2>&1 | head -30
```
Expected: No TypeScript errors.

**Step 8: Commit**

```bash
git add packages/web/src/views/BrowseView.vue
git commit -m "feat(web): replace native selects and pagination with PrimeVue in BrowseView"
```

---

## Task 16: Replace native form controls with PrimeVue in UploadView.vue

**Files:**
- Modify: `packages/web/src/views/UploadView.vue`

**Step 1: Read the file in full**

**Step 2: Add PrimeVue imports to `<script setup>`**

```typescript
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import DatePicker from "primevue/datepicker";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Button from "primevue/button";
```

(Skip any that are already imported.)

**Step 3: Replace Step 2 form controls**

`<input type="text">` for title → `<InputText>`:
```html
<InputText
  :model-value="wizardStore.formData.title ?? ''"
  @update:model-value="wizardStore.updateFormData({ title: $event })"
  class="w-full"
  placeholder="Document title"
/>
```

`<textarea>` for description → `<Textarea>`:
```html
<Textarea
  :model-value="wizardStore.formData.description ?? ''"
  @update:model-value="wizardStore.updateFormData({ description: $event })"
  class="w-full"
  rows="3"
  placeholder="Optional description"
/>
```

`<input type="date">` → `<DatePicker>` (string↔Date conversion):
```html
<DatePicker
  :model-value="wizardStore.formData.documentDate ? new Date(wizardStore.formData.documentDate as string) : null"
  @update:model-value="(v: Date | null) => wizardStore.updateFormData({ documentDate: v ? v.toISOString().split('T')[0] : undefined })"
  class="w-full"
  date-format="yy-mm-dd"
/>
```

`<input type="checkbox">` for saveAsDraft → `<Checkbox>`:
```html
<div class="flex items-center gap-2">
  <Checkbox
    input-id="saveAsDraft"
    :model-value="(wizardStore.formData.saveAsDraft as boolean) ?? false"
    :binary="true"
    @update:model-value="wizardStore.updateFormData({ saveAsDraft: $event })"
  />
  <label for="saveAsDraft" class="text-sm text-secondary">Save as draft</label>
</div>
```

**Step 4: Replace Step 3 form controls**

`<select>` for government level → `<Select>`:
```html
<Select
  :model-value="wizardStore.formData.governmentLevel ?? null"
  :options="[
    { label: 'Federal', value: 'federal' },
    { label: 'State', value: 'state' },
    { label: 'County', value: 'county' },
    { label: 'Place', value: 'place' },
    { label: 'Tribal', value: 'tribal' },
  ]"
  option-label="label"
  option-value="value"
  placeholder="None"
  show-clear
  class="w-full"
  @update:model-value="(v) => wizardStore.updateFormData({
    governmentLevel: v ?? undefined,
    placeGeoid: undefined,
    stateUsps: undefined,
    tribeId: undefined,
  })"
/>
```

`<input type="text" maxlength="2">` for stateUsps → `<InputText>`:
```html
<InputText
  maxlength="2"
  :model-value="wizardStore.formData.stateUsps ?? ''"
  @update:model-value="(v: string) => wizardStore.updateFormData({
    stateUsps: v.toUpperCase() || undefined,
    placeGeoid: undefined,
  })"
  class="w-full uppercase"
  placeholder="e.g. CA"
/>
```

**Step 5: Replace raw `<button>` navigation buttons throughout all steps**

Step 1 Next:
```html
<Button label="Next" :disabled="!wizardStore.file" @click="wizardStore.nextStep()" />
```

Steps 2–3 Back/Next:
```html
<Button label="Back" severity="secondary" @click="wizardStore.prevStep()" />
<Button label="Next" :disabled="!wizardStore.formData.title" @click="wizardStore.nextStep()" />
```

Step 4 Back/Submit:
```html
<Button label="Back" severity="secondary" :disabled="isSubmitting" @click="wizardStore.prevStep()" />
<Button
  :label="isSubmitting ? 'Uploading…' : wizardStore.formData.saveAsDraft ? 'Save Draft' : 'Submit'"
  :loading="isSubmitting"
  @click="handleSubmit"
/>
```

**Step 6: Run typecheck**

```bash
pnpm --filter web typecheck 2>&1 | head -30
```
Expected: No TypeScript errors.

**Step 7: Commit**

```bash
git add packages/web/src/views/UploadView.vue
git commit -m "feat(web): replace native form controls with PrimeVue components in UploadView"
```

---

## Task 17: Remove stale route entry in AppBreadcrumbs.vue

**Files:**
- Modify: `packages/web/src/components/layout/AppBreadcrumbs.vue`

**Step 1: Read the file**

**Step 2: Find and remove line 37**

Remove this line from the `routeTitles` object:
```typescript
"admin-failed-processing": "Failed Processing",
```

**Step 3: Commit**

```bash
git add packages/web/src/components/layout/AppBreadcrumbs.vue
git commit -m "chore(web): remove stale admin-failed-processing route entry from AppBreadcrumbs"
```

---

## Task 18: Final verification

**Step 1: Run linter**

```bash
pnpm --filter web lint 2>&1
```
Expected: Zero token violations. Fix any that surface.

**Step 2: Run typecheck**

```bash
pnpm --filter web typecheck 2>&1
```
Expected: Zero TypeScript errors.

**Step 3: Manual verification checklist**

If the dev server is running (`pnpm --filter web dev`):

1. `/browse` in light + dark mode — state badges render correctly
2. Toggle dark mode from mobile header — icon switches sun↔moon reactively
3. `/browse` with no results — EmptyState component renders with icon and message
4. `/browse` — PrimeVue Select dropdowns open with styled options, clear button works
5. `/browse` with enough documents — Paginator renders; clicking page changes results
6. `/upload` — go through all wizard steps; DatePicker, Checkbox, Select all work
7. Auth pages (`/login`, `/register`, etc.) in dark mode — correct background colors
8. `/documents/:id` — badges appear with correct semantic colors
