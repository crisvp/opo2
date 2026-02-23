<script setup lang="ts">
import { computed } from "vue";
import Drawer from "primevue/drawer";
import Button from "primevue/button";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    header: string;
    width?: string;
    loading?: boolean;
    showFooter?: boolean;
    closable?: boolean;
  }>(),
  {
    width: "450px",
    loading: false,
    showFooter: true,
    closable: true,
  },
);

const emit = defineEmits<{
  "update:visible": [value: boolean];
  close: [];
}>();

const internalVisible = computed({
  get: () => props.visible,
  set: (value) => {
    emit("update:visible", value);
    if (!value) {
      emit("close");
    }
  },
});
</script>

<template>
  <Drawer
    v-model:visible="internalVisible"
    :header="header"
    position="right"
    :style="{ width }"
    :dismissable="closable"
    :closeOnEscape="closable"
    class="slide-panel"
    :pt="{
      root: 'bg-elevated border-l border-default',
      header: 'bg-elevated border-b border-default px-4 py-3',
      title: 'text-primary font-semibold text-lg',
      content: 'p-0 flex-1 overflow-hidden',
      closeButton: 'text-secondary hover:text-primary hover:bg-sunken',
    }"
  >
    <div class="flex flex-col h-full">
      <!-- Loading overlay -->
      <div
        v-if="loading"
        class="absolute inset-0 bg-elevated/80 flex items-center justify-center z-10"
      >
        <i class="pi pi-spin pi-spinner text-2xl text-muted" />
      </div>

      <!-- Main content area -->
      <div class="flex-1 overflow-y-auto p-4">
        <slot />
      </div>

      <!-- Footer with action buttons -->
      <div
        v-if="showFooter"
        class="border-t border-default p-4 bg-elevated flex justify-end gap-2"
      >
        <slot name="footer">
          <Button
            label="Cancel"
            severity="secondary"
            text
            @click="internalVisible = false"
          />
        </slot>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.slide-panel :deep(.p-drawer) {
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
}
</style>
