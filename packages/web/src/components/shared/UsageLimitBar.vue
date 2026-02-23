<script setup lang="ts">
import { computed } from "vue";
import ProgressBar from "primevue/progressbar";

const props = defineProps<{
  limitType: string;
  used: number;
  limit: number;
  remaining: number;
}>();

const percentage = computed(() =>
  props.limit > 0 ? Math.min(100, Math.round((props.used / props.limit) * 100)) : 0,
);

const severity = computed(() => {
  if (percentage.value >= 90) return "danger";
  if (percentage.value >= 70) return "warn";
  return undefined;
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex justify-between text-sm">
      <span class="capitalize">{{ limitType.replace(/_/g, " ") }}</span>
      <span>{{ used }} / {{ limit }}</span>
    </div>
    <ProgressBar
      :value="percentage"
      :class="{
        'p-progressbar-danger': severity === 'danger',
        'p-progressbar-warn': severity === 'warn',
      }"
    />
    <span class="text-xs text-muted">{{ remaining }} remaining</span>
  </div>
</template>
