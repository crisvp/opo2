<script setup lang="ts">
import { ref } from "vue";
import {
  useStateMetadataList,
  useCreateStateMetadata,
  useUpdateStateMetadata,
  useDeleteStateMetadata,
} from "../../api/queries/agencies";

const filterState = ref<string | null>(null);
const { data, isLoading } = useStateMetadataList(filterState);
const { mutate: createEntry, isPending: createPending } = useCreateStateMetadata();
const { mutate: updateEntry, isPending: updatePending } = useUpdateStateMetadata();
const { mutate: deleteEntry, isPending: deletePending } = useDeleteStateMetadata();

const showCreateForm = ref(false);
const editingId = ref<string | null>(null);

const newEntry = ref({
  stateUsps: "",
  key: "",
  value: "",
  url: "",
});

const editEntry = ref({
  value: "",
  url: "",
});

function submitCreate() {
  createEntry(
    {
      stateUsps: newEntry.value.stateUsps,
      key: newEntry.value.key,
      value: newEntry.value.value,
      url: newEntry.value.url || null,
    },
    {
      onSuccess: () => {
        showCreateForm.value = false;
        newEntry.value = { stateUsps: "", key: "", value: "", url: "" };
      },
    },
  );
}

function startEdit(entry: Record<string, unknown>) {
  editingId.value = entry.id as string;
  editEntry.value = {
    value: entry.value as string,
    url: (entry.url as string) ?? "",
  };
}

function submitEdit() {
  if (!editingId.value) return;
  updateEntry(
    {
      id: editingId.value,
      value: editEntry.value.value,
      url: editEntry.value.url || null,
    },
    {
      onSuccess: () => {
        editingId.value = null;
      },
    },
  );
}
</script>

<template>
  <div class="p-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-primary">State Metadata Management</h1>
      <button
        class="px-4 py-2 text-sm rounded border border-default text-primary hover:bg-surface-subtle"
        @click="showCreateForm = !showCreateForm"
      >
        {{ showCreateForm ? "Cancel" : "Add Entry" }}
      </button>
    </div>

    <!-- Filter -->
    <div class="flex gap-3 items-center">
      <input
        v-model="filterState"
        placeholder="Filter by state (e.g. CA)"
        maxlength="2"
        class="w-40 px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
      />
    </div>

    <!-- Create Form -->
    <div v-if="showCreateForm" class="bg-elevated rounded-lg p-5 space-y-4">
      <h2 class="text-base font-medium text-primary">New State Metadata Entry</h2>
      <div class="grid grid-cols-2 gap-4">
        <input
          v-model="newEntry.stateUsps"
          placeholder="State (e.g. CA)"
          maxlength="2"
          class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
        <input
          v-model="newEntry.key"
          placeholder="Key"
          class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
        <textarea
          v-model="newEntry.value"
          placeholder="Value"
          rows="3"
          class="col-span-2 px-3 py-2 text-sm rounded border border-default bg-surface text-primary resize-none"
        />
        <input
          v-model="newEntry.url"
          placeholder="URL (optional)"
          class="col-span-2 px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
        />
      </div>
      <button
        class="px-4 py-2 text-sm rounded border border-default text-primary hover:bg-surface-subtle disabled:opacity-50"
        :disabled="createPending"
        @click="submitCreate"
      >
        {{ createPending ? "Saving..." : "Create Entry" }}
      </button>
    </div>

    <!-- Entries List -->
    <div v-if="isLoading" class="text-muted text-sm">Loading...</div>
    <div v-else-if="!data || (data as unknown[]).length === 0" class="text-muted text-sm">
      No metadata entries found.
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="entry in data as Record<string, unknown>[]"
        :key="entry.id as string"
        class="bg-elevated rounded-lg p-4"
      >
        <div v-if="editingId === entry.id" class="space-y-3">
          <textarea
            v-model="editEntry.value"
            rows="3"
            class="w-full px-3 py-2 text-sm rounded border border-default bg-surface text-primary resize-none"
          />
          <input
            v-model="editEntry.url"
            placeholder="URL (optional)"
            class="w-full px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
          />
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
        <div v-else class="flex justify-between items-start gap-4">
          <div class="space-y-1 flex-1 min-w-0">
            <p class="text-xs text-muted font-mono">
              [{{ entry.stateUsps as string }}] {{ entry.key as string }}
            </p>
            <p class="text-sm text-primary truncate">{{ entry.value as string }}</p>
            <a
              v-if="entry.url"
              :href="entry.url as string"
              target="_blank"
              class="text-xs text-muted hover:underline"
            >
              {{ entry.url as string }}
            </a>
          </div>
          <div class="flex gap-2 shrink-0">
            <button
              class="px-3 py-1 text-sm rounded border border-default text-primary hover:bg-surface-subtle"
              @click="startEdit(entry)"
            >
              Edit
            </button>
            <button
              class="px-3 py-1 text-sm rounded border border-default text-critical hover:bg-critical-subtle disabled:opacity-50"
              :disabled="deletePending"
              @click="deleteEntry(entry.id as string)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
