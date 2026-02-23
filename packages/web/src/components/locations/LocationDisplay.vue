<script setup lang="ts">
defineProps<{
  level: string | null;
  stateName?: string | null;
  placeName?: string | null;
  tribeName?: string | null;
}>();
</script>

<template>
  <div class="text-primary">
    <span v-if="!level" class="text-muted">No location selected</span>
    <template v-else-if="level === 'federal'">
      <span class="font-medium">Federal</span>
    </template>
    <template v-else-if="level === 'state'">
      <span class="font-medium">State</span>
      <span v-if="stateName"> — {{ stateName }}</span>
    </template>
    <template v-else-if="level === 'place'">
      <span class="font-medium">Local</span>
      <span v-if="placeName"> — {{ placeName }}</span>
      <span v-if="stateName && !placeName"> — {{ stateName }}</span>
    </template>
    <template v-else-if="level === 'tribal'">
      <span class="font-medium">Tribal</span>
      <span v-if="tribeName"> — {{ tribeName }}</span>
    </template>
  </div>
</template>
