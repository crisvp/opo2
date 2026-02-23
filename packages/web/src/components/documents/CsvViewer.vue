<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  content: string;
}>();

const rows = computed(() => {
  return props.content
    .split("\n")
    .map((line) => line.split(",").map((c) => c.trim()));
});

const headers = computed(() => rows.value[0] ?? []);
const dataRows = computed(() => rows.value.slice(1).filter((r) => r.some((c) => c)));
</script>

<template>
  <div class="overflow-auto max-h-96" data-testid="csv-viewer">
    <table class="min-w-full text-sm border-collapse">
      <thead>
        <tr>
          <th
            v-for="(header, i) in headers"
            :key="i"
            class="px-3 py-2 text-left font-medium text-secondary bg-sunken border border-default"
          >
            {{ header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in dataRows" :key="ri" class="hover:bg-sunken">
          <td
            v-for="(cell, ci) in row"
            :key="ci"
            class="px-3 py-2 border border-default text-primary"
          >
            {{ cell }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="dataRows.length === 0" class="text-muted p-4 text-center">No data</p>
  </div>
</template>
