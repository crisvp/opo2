<script setup lang="ts">
defineProps<{
  policyType: string;
  hasPolicy: boolean;
  documentId?: string | null;
}>();
</script>

<template>
  <div
    class="flex items-center justify-between px-4 py-3 border border-default rounded-lg"
    :data-testid="`policy-card-${policyType}`"
  >
    <span class="text-sm font-medium text-primary capitalize">{{ policyType.replace(/_/g, ' ') }}</span>
    <RouterLink
      v-if="hasPolicy && documentId"
      :to="`/documents/${documentId}`"
      class="text-sm font-semibold text-success hover:underline"
    >
      Policy Found
    </RouterLink>
    <span
      v-else
      :class="hasPolicy ? 'text-success font-semibold' : 'text-muted'"
      class="text-sm"
    >
      {{ hasPolicy ? 'Policy Found' : 'No Policy' }}
    </span>
  </div>
</template>
