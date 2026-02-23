<script setup lang="ts">
import { computed } from "vue";

interface Association {
  id: string;
  entryId: string;
  entryName: string;
  typeId: string | null;
  typeName: string | null;
  role: string | null;
}

const props = defineProps<{
  associations: Association[];
}>();

// Group associations by typeName
const grouped = computed(() => {
  const map = new Map<string, Association[]>();
  for (const a of props.associations) {
    const key = a.typeName ?? "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return map;
});
</script>

<template>
  <div class="space-y-4" data-testid="document-associations-panel">
    <div v-if="!associations || associations.length === 0" class="text-muted text-sm">
      No associations.
    </div>
    <div v-else v-for="[typeName, items] in grouped" :key="typeName">
      <h4 class="text-sm font-semibold text-secondary mb-2">{{ typeName }}</h4>
      <ul class="space-y-1">
        <li
          v-for="item in items"
          :key="item.id"
          class="text-sm text-primary flex items-center gap-2"
        >
          <span>{{ item.entryName }}</span>
          <span v-if="item.role" class="text-xs text-muted">({{ item.role }})</span>
        </li>
      </ul>
    </div>
  </div>
</template>
