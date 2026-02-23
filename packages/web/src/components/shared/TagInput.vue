<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [tags: string[]];
}>();

const input = ref("");

function addTag() {
  const tag = input.value.trim().toLowerCase();
  if (tag && !props.modelValue.includes(tag)) {
    emit("update:modelValue", [...props.modelValue, tag]);
  }
  input.value = "";
}

function removeTag(tag: string) {
  emit(
    "update:modelValue",
    props.modelValue.filter((t) => t !== tag),
  );
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag();
  }
  // Remove last tag on backspace when input is empty
  if (e.key === "Backspace" && !input.value && props.modelValue.length > 0) {
    emit("update:modelValue", props.modelValue.slice(0, -1));
  }
}
</script>

<template>
  <div
    class="flex flex-wrap gap-2 p-2 border border-default rounded-lg min-h-10"
    data-testid="tag-input"
  >
    <span
      v-for="tag in modelValue"
      :key="tag"
      class="inline-flex items-center gap-1 px-2 py-0.5 bg-sunken rounded text-sm"
      data-testid="tag-chip"
    >
      {{ tag }}
      <button
        type="button"
        class="text-muted hover:text-primary ml-1"
        @click="removeTag(tag)"
        :aria-label="`Remove ${tag}`"
        data-testid="remove-tag"
      >
        ×
      </button>
    </span>
    <input
      v-model="input"
      type="text"
      placeholder="Add tag…"
      class="border-none outline-none flex-1 min-w-24 text-sm bg-transparent"
      @keydown="onKeydown"
      @blur="addTag"
      data-testid="tag-text-input"
    />
  </div>
</template>
