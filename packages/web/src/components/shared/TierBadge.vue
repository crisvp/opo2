<script setup lang="ts">
import { computed } from "vue";
import Tag from "primevue/tag";

const props = defineProps<{
  tier: number;
  name?: string;
}>();

const severity = computed(() => {
  if (props.tier >= 3) return "success";
  if (props.tier === 2) return "info";
  return "secondary";
});
</script>

<template>
  <Tag :value="name ?? `Tier ${tier}`" :severity="severity" />
</template>
