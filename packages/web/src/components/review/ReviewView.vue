<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { GovernmentLevel } from "@opo/shared";
import {
  useDocumentDetail,
  useDocumentAiMetadata,
  useUpdateDocument,
  useUpdateDocumentLocation,
  useSyncTags,
  useSubmitForModeration,
} from "../../api/queries/documents";
import AiSuggestionRow from "./AiSuggestionRow.vue";
import type { FieldStatus } from "./AiSuggestionRow.vue";
import TagInput from "../shared/TagInput.vue";
import LocationSelector from "../locations/LocationSelector.vue";

const props = defineProps<{
  documentId: string;
}>();

const docId = computed(() => props.documentId);

const { data: docData, isLoading: docLoading, isError: docError } = useDocumentDetail(docId);
const { data: aiData, isLoading: aiLoading } = useDocumentAiMetadata(docId);

const updateDoc = useUpdateDocument();
const updateLocation = useUpdateDocumentLocation();
const syncTags = useSyncTags();
const submitForModeration = useSubmitForModeration();

// ── AI metadata row type as returned by the ai-metadata endpoint (raw DB columns) ──
interface RawMetaRow {
  id: string;
  document_id: string;
  field_key: string;
  field_definition_id: string | null;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: unknown;
  source: string | null;
  confidence: number | null;
}

interface AiMetadataResponse {
  processingResults: Record<string, unknown> | null;
  metadata: RawMetaRow[];
  catalogMatches: Array<{ entryId: string; name: string; typeId: string | null; confidence: number | null }>;
}

const aiMeta = computed(() => aiData.value as AiMetadataResponse | null | undefined);

// Fields that map to long-text editor
const LONG_FIELDS = new Set(["description", "summary", "notes", "reasoning"]);

// ── AI suggestion rows derived from metadata ──
interface SuggestionField {
  key: string;
  label: string;
  aiValue: string | null;
  isLongField: boolean;
}

const suggestionFields = computed<SuggestionField[]>(() => {
  const rows = aiMeta.value?.metadata;
  if (!rows || rows.length === 0) return [];
  return rows.map((row) => {
    let displayValue: string | null = null;
    if (row.value_text !== null && row.value_text !== undefined) {
      displayValue = row.value_text;
    } else if (row.value_number !== null && row.value_number !== undefined) {
      displayValue = String(row.value_number);
    } else if (row.value_date !== null && row.value_date !== undefined) {
      displayValue = row.value_date;
    } else if (row.value_boolean !== null && row.value_boolean !== undefined) {
      displayValue = row.value_boolean ? "Yes" : "No";
    } else if (row.value_json !== null && row.value_json !== undefined) {
      displayValue = JSON.stringify(row.value_json);
    }
    return {
      key: row.field_key,
      label: row.field_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      aiValue: displayValue,
      isLongField: LONG_FIELDS.has(row.field_key),
    };
  });
});

const hasAiData = computed(() => suggestionFields.value.length > 0);

// ── Tab state ──
const activeTab = ref<"review" | "edit">("review");

watch(
  hasAiData,
  (has) => {
    if (!has && !aiLoading.value) {
      activeTab.value = "edit";
    }
  },
  { immediate: true },
);

// ── Shared form state ──
const formValues = reactive<Record<string, string | null>>({});
const fieldStatuses = reactive<Record<string, FieldStatus>>({});

// Initialize suggestion statuses from AI fields
watch(
  suggestionFields,
  (fields) => {
    for (const field of fields) {
      if (!(field.key in fieldStatuses)) {
        formValues[field.key] = field.aiValue;
        fieldStatuses[field.key] = "pending";
      }
    }
  },
  { immediate: true },
);

// ── Edit tab form state (shared with review) ──
const title = ref("");
const description = ref<string>("");
const documentDate = ref<string>("");
const category = ref<string | null>(null);
const governmentLevel = ref<GovernmentLevel | null>(null);
const stateUsps = ref<string | null>(null);
const placeGeoid = ref<string | null>(null);
const tribeId = ref<string | null>(null);
const tags = ref<string[]>([]);

// Populate edit form from document
watch(
  docData,
  (doc) => {
    if (!doc) return;
    title.value = doc.title ?? "";
    description.value = doc.description ?? "";
    documentDate.value = doc.documentDate ?? "";
    category.value = doc.category ?? null;
    governmentLevel.value = (doc.governmentLevel as GovernmentLevel | null) ?? null;
    stateUsps.value = doc.stateUsps ?? null;
    placeGeoid.value = doc.placeGeoid ?? null;
    tribeId.value = doc.tribeId ?? null;
    tags.value = doc.tags ?? [];
  },
  { immediate: true },
);

// ── Submit gate ──
const allResolved = computed(() =>
  suggestionFields.value.length === 0 ||
  Object.values(fieldStatuses).every((s) => s !== "pending"),
);

const canSubmit = computed(() => activeTab.value === "edit" || allResolved.value);

// ── Actions ──
const submitError = ref("");
const isSaving = ref(false);

async function handleSubmit() {
  if (!docData.value) return;
  submitError.value = "";
  isSaving.value = true;

  try {
    // Save document edits first
    await updateDoc.mutateAsync({
      id: props.documentId,
      title: title.value,
      description: description.value || null,
      documentDate: documentDate.value || null,
      category: category.value || null,
    });

    await updateLocation.mutateAsync({
      id: props.documentId,
      governmentLevel: governmentLevel.value,
      stateUsps: stateUsps.value,
      placeGeoid: placeGeoid.value,
      tribeId: tribeId.value,
    });

    await syncTags.mutateAsync({
      id: props.documentId,
      tags: tags.value,
    });

    // Then submit for moderation
    await submitForModeration.mutateAsync(props.documentId);
  } catch {
    submitError.value = "Failed to submit. Please try again.";
  } finally {
    isSaving.value = false;
  }
}

function handleFieldUpdate(key: string, value: string | null) {
  formValues[key] = value;
}

function handleStatusUpdate(key: string, status: FieldStatus) {
  fieldStatuses[key] = status;
}

const isLoading = computed(() => docLoading.value);
const isError = computed(() => docError.value);
const doc = computed(() => docData.value);
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading…</div>

    <!-- Error -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load document.
    </div>

    <template v-else-if="doc">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-primary">Review Document</h1>
          <p class="text-base text-secondary mt-1">{{ doc.title }}</p>
        </div>
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-subtle text-accent shrink-0"
        >
          {{ doc.state.replace(/_/g, " ") }}
        </span>
      </div>

      <!-- Tab bar (only show if AI data exists) -->
      <div v-if="hasAiData" class="flex gap-1 border-b border-default mb-6">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="
            activeTab === 'review'
              ? 'border-interactive text-primary'
              : 'border-transparent text-secondary hover:text-primary'
          "
          data-testid="tab-review"
          @click="activeTab = 'review'"
        >
          Review AI Suggestions
          <span
            v-if="!allResolved"
            class="ml-1.5 text-xs bg-warning-subtle text-warning rounded-full px-1.5 py-0.5"
          >
            {{ Object.values(fieldStatuses).filter((s) => s === 'pending').length }} pending
          </span>
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="
            activeTab === 'edit'
              ? 'border-interactive text-primary'
              : 'border-transparent text-secondary hover:text-primary'
          "
          data-testid="tab-edit"
          @click="activeTab = 'edit'"
        >
          Edit Details
        </button>
      </div>

      <!-- Review tab -->
      <template v-if="activeTab === 'review' && hasAiData">
        <div class="space-y-3 mb-6" data-testid="review-tab">
          <p class="text-sm text-secondary mb-4">
            The AI extracted the following fields. Accept, edit, or discard each suggestion before submitting.
          </p>
          <AiSuggestionRow
            v-for="field in suggestionFields"
            :key="field.key"
            :field-key="field.key"
            :label="field.label"
            :ai-value="field.aiValue"
            :model-value="formValues[field.key] ?? null"
            :status="fieldStatuses[field.key] ?? 'pending'"
            :is-long-field="field.isLongField"
            @update:model-value="handleFieldUpdate(field.key, $event)"
            @update:status="handleStatusUpdate(field.key, $event)"
          />
        </div>

        <!-- All resolved banner -->
        <div
          v-if="allResolved"
          class="bg-success-subtle border border-success rounded-lg px-4 py-3 text-sm text-success mb-4"
          data-testid="all-resolved-banner"
        >
          All fields resolved. You can now submit for moderation.
        </div>
      </template>

      <!-- Edit tab -->
      <template v-else-if="activeTab === 'edit' || !hasAiData">
        <form class="space-y-5 mb-6" data-testid="edit-tab" @submit.prevent>
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-secondary mb-1" for="review-title">
              Title <span class="text-critical">*</span>
            </label>
            <input
              id="review-title"
              v-model="title"
              type="text"
              required
              class="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
              data-testid="title-input"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-secondary mb-1" for="review-description">
              Description
            </label>
            <textarea
              id="review-description"
              v-model="description"
              rows="4"
              class="w-full border border-default rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus"
              data-testid="description-input"
            />
          </div>

          <!-- Document Date -->
          <div>
            <label class="block text-sm font-medium text-secondary mb-1" for="review-date">
              Document Date
            </label>
            <input
              id="review-date"
              v-model="documentDate"
              type="date"
              class="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
              data-testid="date-input"
            />
          </div>

          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-secondary mb-1" for="review-category">
              Category
            </label>
            <input
              id="review-category"
              v-model="category"
              type="text"
              class="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
              data-testid="category-input"
            />
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium text-secondary mb-1">Tags</label>
            <TagInput v-model="tags" />
          </div>

          <!-- Location -->
          <div>
            <label class="block text-sm font-medium text-secondary mb-2">Location</label>
            <LocationSelector
              :government-level="governmentLevel"
              :state-usps="stateUsps"
              :place-geoid="placeGeoid"
              :tribe-id="tribeId"
              @update:government-level="governmentLevel = $event"
              @update:state-usps="stateUsps = $event"
              @update:place-geoid="placeGeoid = $event"
              @update:tribe-id="tribeId = $event"
            />
          </div>
        </form>
      </template>

      <!-- Submit area -->
      <div class="flex items-center justify-between pt-4 border-t border-default">
        <p v-if="submitError" class="text-sm text-critical">{{ submitError }}</p>
        <div v-else class="text-sm text-muted">
          <template v-if="activeTab === 'review' && hasAiData && !allResolved">
            Resolve all AI suggestions to enable submission.
          </template>
        </div>

        <button
          type="button"
          class="px-5 py-2 bg-interactive text-inverted rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canSubmit || isSaving"
          data-testid="submit-for-moderation-button"
          @click="handleSubmit"
        >
          {{ isSaving ? "Submitting…" : "Submit for Moderation" }}
        </button>
      </div>
    </template>
  </div>
</template>
