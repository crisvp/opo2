<script setup lang="ts">
interface MetadataEntry {
  id: string;
  fieldKey: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean?: boolean | null;
  source?: string | null;
  confidence?: number | null;
}

interface MetadataFieldDefinition {
  id: string;
  key: string;
  label?: string;
  fieldType?: string;
}

defineProps<{
  metadata: MetadataEntry[];
  fields?: MetadataFieldDefinition[];
}>();

function getDisplayValue(entry: MetadataEntry): string {
  if (entry.valueText != null) return entry.valueText;
  if (entry.valueNumber != null) return String(entry.valueNumber);
  if (entry.valueDate != null) return new Date(entry.valueDate).toLocaleDateString();
  if (entry.valueBoolean != null) return entry.valueBoolean ? "Yes" : "No";
  return "—";
}
</script>

<template>
  <div class="space-y-2" data-testid="document-metadata-panel">
    <div v-if="!metadata || metadata.length === 0" class="text-muted text-sm">
      No metadata available.
    </div>
    <dl v-else class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <template v-for="entry in metadata" :key="entry.id">
        <dt class="font-medium text-secondary">{{ entry.fieldKey }}</dt>
        <dd class="text-primary">
          {{ getDisplayValue(entry) }}
          <span v-if="entry.source" class="text-xs text-muted ml-1">({{ entry.source }})</span>
        </dd>
      </template>
    </dl>
  </div>
</template>
