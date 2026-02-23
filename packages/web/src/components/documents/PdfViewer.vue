<script setup lang="ts">
defineProps<{
  url: string;
}>();
</script>

<template>
  <iframe :src="url" class="w-full h-full border-0" title="PDF Preview" />
</template>
