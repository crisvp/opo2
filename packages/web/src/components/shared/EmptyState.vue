<script setup lang="ts">
defineProps<{
  icon?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
    <i v-if="icon" :class="['pi', icon, 'text-4xl text-muted']" aria-hidden="true" />
    <p class="text-base font-medium text-primary">{{ title }}</p>
    <p v-if="description" class="text-sm text-muted max-w-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
