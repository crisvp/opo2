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
