<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  accept?: string;
  maxSize?: number;
}>();

const emit = defineEmits<{
  select: [file: File];
  error: [message: string];
}>();

const dragOver = ref(false);
const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function handleFile(file: File) {
  if (props.maxSize && file.size > props.maxSize) {
    emit("error", `File too large. Max ${Math.round(props.maxSize / 1024 / 1024)}MB`);
    return;
  }
  selectedFile.value = file;
  emit("select", file);
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFile(file);
}

function onClick() {
  fileInput.value?.click();
}
</script>

<template>
  <div
    class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
    :class="dragOver ? 'border-primary bg-sunken' : 'border-default'"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
    @click="onClick"
    data-testid="dropzone"
    role="button"
    tabindex="0"
    @keydown.enter="onClick"
    @keydown.space.prevent="onClick"
  >
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="accept"
      @change="onFileInput"
      data-testid="file-input"
    />
    <div v-if="selectedFile">
      <p class="font-medium text-primary">{{ selectedFile.name }}</p>
      <p class="text-sm text-muted mt-1">
        {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB
      </p>
    </div>
    <div v-else>
      <p class="text-muted">Drop a file here or click to browse</p>
      <p v-if="maxSize" class="text-xs text-muted mt-1">
        Max size: {{ Math.round(maxSize / 1024 / 1024) }}MB
      </p>
    </div>
  </div>
</template>
