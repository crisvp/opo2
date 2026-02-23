<script setup lang="ts">
import { ref, computed } from "vue";
import {
  useAgencyList,
  useCreateAgency,
  useUpdateAgency,
  useDeleteAgency,
} from "../../api/queries/agencies";

const stateUsps = ref<string | null>(null);
const { data, isLoading } = useAgencyList(stateUsps);
const { mutate: createAgency, isPending: createPending } = useCreateAgency();
const { mutate: updateAgency, isPending: updatePending } = useUpdateAgency();
const { mutate: deleteAgency, isPending: deletePending } = useDeleteAgency();

const showCreateForm = ref(false);
const editingId = ref<string | null>(null);

const newAgency = ref({
  stateUsps: "",
  name: "",
  abbreviation: "",
  category: "",
  websiteUrl: "",
});

const editAgency = ref({
  name: "",
  abbreviation: "",
  category: "",
  websiteUrl: "",
});

function submitCreate() {
  createAgency(
    {
      stateUsps: newAgency.value.stateUsps,
      name: newAgency.value.name,
      abbreviation: newAgency.value.abbreviation || null,
      category: newAgency.value.category || null,
      websiteUrl: newAgency.value.websiteUrl || null,
    },
    {
      onSuccess: () => {
        showCreateForm.value = false;
        newAgency.value = { stateUsps: "", name: "", abbreviation: "", category: "", websiteUrl: "" };
      },
    },
  );
}

function startEdit(agency: Record<string, unknown>) {
  editingId.value = agency.id as string;
  editAgency.value = {
    name: agency.name as string,
    abbreviation: (agency.abbreviation as string) ?? "",
    category: (agency.category as string) ?? "",
    websiteUrl: (agency.websiteUrl as string) ?? "",
  };
}

function submitEdit() {
  if (!editingId.value) return;
  updateAgency(
    {
      id: editingId.value,
      name: editAgency.value.name,
      abbreviation: editAgency.value.abbreviation || null,
      category: editAgency.value.category || null,
      websiteUrl: editAgency.value.websiteUrl || null,
    },
    {
      onSuccess: () => {
        editingId.value = null;
      },
    },
  );
}

const agencies = computed(() => {
  if (!data.value) return [];
  const d = data.value as unknown as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as Record<string, unknown>[];
  if (Array.isArray(data.value)) return data.value as unknown as Record<string, unknown>[];
  return [];
});
</script>

<template>
  <div class="p-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-primary">Agencies Management</h1>
      <button
        class="px-4 py-2 text-sm rounded border border-default text-primary hover:bg-surface-subtle"
        @click="showCreateForm = !showCreateForm"
      >
        {{ showCreateForm ? "Cancel" : "Add Agency" }}
      </button>
    </div>

    <!-- Create Form -->
    <div v-if="showCreateForm" class="bg-elevated rounded-lg p-5 space-y-4">
      <h2 class="text-base font-medium text-primary">New Agency</h2>
      <div class="grid grid-cols-2 gap-4">
        <input
          v-model="newAgency.stateUsps"
          placeholder="State (e.g. CA)"
          maxlength="2"
          class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
        <input
          v-model="newAgency.name"
          placeholder="Agency name"
          class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
        <input
          v-model="newAgency.abbreviation"
          placeholder="Abbreviation (optional)"
          class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
        <input
          v-model="newAgency.category"
          placeholder="Category (optional)"
          class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
        <input
          v-model="newAgency.websiteUrl"
          placeholder="Website URL (optional)"
          class="col-span-2 px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
      </div>
      <button
        class="px-4 py-2 text-sm rounded border border-default text-primary hover:bg-surface-subtle disabled:opacity-50"
        :disabled="createPending"
        @click="submitCreate"
      >
        {{ createPending ? "Saving..." : "Create Agency" }}
      </button>
    </div>

    <!-- Agency List -->
    <div v-if="isLoading" class="text-muted text-sm">Loading...</div>
    <div v-else-if="agencies.length === 0" class="text-muted text-sm">No agencies found.</div>
    <div v-else class="space-y-3">
      <div
        v-for="agency in agencies"
        :key="agency.id as string"
        class="bg-elevated rounded-lg p-4"
      >
        <div v-if="editingId === agency.id" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <input
              v-model="editAgency.name"
              class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
            />
            <input
              v-model="editAgency.abbreviation"
              placeholder="Abbreviation"
              class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
            />
            <input
              v-model="editAgency.category"
              placeholder="Category"
              class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
            />
            <input
              v-model="editAgency.websiteUrl"
              placeholder="Website URL"
              class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-sm rounded border border-default text-primary hover:bg-surface-subtle disabled:opacity-50"
              :disabled="updatePending"
              @click="submitEdit"
            >
              Save
            </button>
            <button
              class="px-3 py-1 text-sm rounded border border-default text-muted hover:bg-surface-subtle"
              @click="editingId = null"
            >
              Cancel
            </button>
          </div>
        </div>
        <div v-else class="flex justify-between items-center">
          <div class="space-y-0.5">
            <p class="font-medium text-primary text-sm">
              [{{ agency.stateUsps as string }}] {{ agency.name as string }}
            </p>
            <p class="text-xs text-muted">
              {{ agency.category as string ?? "No category" }}
              <span v-if="agency.abbreviation"> · {{ agency.abbreviation as string }}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-sm rounded border border-default text-primary hover:bg-surface-subtle"
              @click="startEdit(agency)"
            >
              Edit
            </button>
            <button
              class="px-3 py-1 text-sm rounded border border-default text-critical hover:bg-critical-subtle disabled:opacity-50"
              :disabled="deletePending"
              @click="deleteAgency(agency.id as string)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
