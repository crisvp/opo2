<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { GovernmentLevel } from "@opo/shared";
import { EDITABLE_STATES } from "@opo/shared";
import {
  useDocumentDetail,
  useUpdateDocument,
  useUpdateDocumentLocation,
  useSyncTags,
} from "../api/queries/documents";
import TagInput from "../components/shared/TagInput.vue";
import LocationSelector from "../components/locations/LocationSelector.vue";

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.id as string);

const { data: docData, isLoading, isError } = useDocumentDetail(id);

const updateDoc = useUpdateDocument();
const updateLocation = useUpdateDocumentLocation();
const syncTags = useSyncTags();

// Form state
const title = ref("");
const description = ref<string>("");
const documentDate = ref<string>("");
const category = ref<string | null>(null);
const governmentLevel = ref<GovernmentLevel | null>(null);
const stateUsps = ref<string | null>(null);
const placeGeoid = ref<string | null>(null);
const tribeId = ref<string | null>(null);
const tags = ref<string[]>([]);

const saveError = ref("");
const isSaving = ref(false);

// Populate form from document data
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

const doc = computed(() => docData.value);

const isEditable = computed(() => {
  if (!doc.value) return false;
  return EDITABLE_STATES.includes(doc.value.state as (typeof EDITABLE_STATES)[number]);
});

async function handleSave() {
  if (!doc.value) return;
  saveError.value = "";
  isSaving.value = true;

  try {
    await updateDoc.mutateAsync({
      id: id.value,
      title: title.value,
      description: description.value || null,
      documentDate: documentDate.value || null,
      category: category.value || null,
    });

    await updateLocation.mutateAsync({
      id: id.value,
      governmentLevel: governmentLevel.value,
      stateUsps: stateUsps.value,
      placeGeoid: placeGeoid.value,
      tribeId: tribeId.value,
    });

    await syncTags.mutateAsync({
      id: id.value,
      tags: tags.value,
    });

    await router.push(`/documents/${id.value}`);
  } catch {
    saveError.value = "Failed to save changes. Please try again.";
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-8">
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading...</div>

    <!-- Error loading document -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load document.
    </div>

    <!-- Not editable -->
    <div v-else-if="doc && !isEditable" class="text-center py-12 text-muted">
      <p>This document cannot be edited in its current state ({{ doc.state }}).</p>
      <RouterLink :to="`/documents/${id}`" class="text-primary underline text-sm mt-2 block">
        Back to document
      </RouterLink>
    </div>

    <!-- Edit form -->
    <template v-else-if="doc">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold text-primary">Edit Document</h1>
        <RouterLink :to="`/documents/${id}`" class="text-sm text-secondary hover:underline">
          Cancel
        </RouterLink>
      </div>

      <form class="space-y-5" @submit.prevent="handleSave">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium text-secondary mb-1" for="edit-title">
            Title <span class="text-critical">*</span>
          </label>
          <input
            id="edit-title"
            v-model="title"
            type="text"
            required
            class="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            data-testid="title-input"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-secondary mb-1" for="edit-description">
            Description
          </label>
          <textarea
            id="edit-description"
            v-model="description"
            rows="4"
            class="w-full border border-default rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus"
            data-testid="description-input"
          />
        </div>

        <!-- Document Date -->
        <div>
          <label class="block text-sm font-medium text-secondary mb-1" for="edit-date">
            Document Date
          </label>
          <input
            id="edit-date"
            v-model="documentDate"
            type="date"
            class="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            data-testid="date-input"
          />
        </div>

        <!-- Category -->
        <div>
          <label class="block text-sm font-medium text-secondary mb-1" for="edit-category">
            Category
          </label>
          <input
            id="edit-category"
            v-model="category"
            type="text"
            class="w-full border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            data-testid="category-input"
          />
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-medium text-secondary mb-1">
            Tags
          </label>
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

        <!-- Error -->
        <p v-if="saveError" class="text-sm text-critical">{{ saveError }}</p>

        <!-- Submit -->
        <div class="flex justify-end gap-3 pt-2">
          <RouterLink
            :to="`/documents/${id}`"
            class="px-4 py-2 border border-default rounded-lg text-sm"
          >
            Cancel
          </RouterLink>
          <button
            type="submit"
            class="px-4 py-2 bg-interactive text-inverted rounded-lg text-sm disabled:opacity-50"
            :disabled="isSaving"
            data-testid="save-button"
          >
            Save Changes
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
