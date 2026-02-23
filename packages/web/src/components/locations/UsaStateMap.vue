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
  return `${state.name} — ${count} document${count !== 1 ? "s" : ""}`;
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
        class="fill-primary stroke-surface stroke-[0.5] cursor-pointer transition-[fill-opacity] duration-150 hover:opacity-80"
        @click="handleClick(location.id)"
      />
    </svg>
  </div>
</template>
