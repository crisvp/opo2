<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const localValue = ref(props.modelValue);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (val) => {
    localValue.value = val;
  },
);

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  localValue.value = value;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit("update:modelValue", value);
  }, 300);
}
</script>

<template>
  <div class="relative flex items-center" data-testid="search-input">
    <span
      class="absolute left-3 text-muted pointer-events-none"
      aria-hidden="true"
    >
      &#x1F50D;
    </span>
    <input
      type="text"
      :value="localValue"
      :placeholder="placeholder ?? 'Search…'"
      class="w-full pl-9 pr-4 py-2 border border-default rounded-lg bg-elevated text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus"
      @input="onInput"
      data-testid="search-text-input"
    />
  </div>
</template>
