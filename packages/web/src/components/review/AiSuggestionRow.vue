<script setup lang="ts">
import { ref, watch } from "vue";

export type FieldStatus = "pending" | "accepted" | "edited" | "discarded";

const props = defineProps<{
  fieldKey: string;
  label: string;
  aiValue: string | null;
  modelValue: string | null;
  status: FieldStatus;
  isLongField?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
  "update:status": [status: FieldStatus];
}>();

const isEditing = ref(false);
const editBuffer = ref<string>("");

watch(
  () => props.status,
  (s) => {
    if (s !== "edited") {
      isEditing.value = false;
    }
  },
);

function handleAccept() {
  isEditing.value = false;
  emit("update:modelValue", props.aiValue);
  emit("update:status", "accepted");
}

function handleDiscard() {
  isEditing.value = false;
  emit("update:modelValue", null);
  emit("update:status", "discarded");
}

function handleEdit() {
  editBuffer.value = props.aiValue ?? "";
  isEditing.value = true;
}

function handleSaveEdit() {
  emit("update:modelValue", editBuffer.value || null);
  emit("update:status", "edited");
  isEditing.value = false;
}

function handleCancelEdit() {
  isEditing.value = false;
  if (props.status === "edited") {
    // keep existing edited value
  }
}
</script>

<template>
  <div
    class="border border-default rounded-lg p-4 transition-colors"
    :class="{
      'bg-surface': status === 'pending',
      'bg-success-subtle border-success': status === 'accepted',
      'bg-info-subtle border-info': status === 'edited',
      'bg-surface-subtle opacity-60': status === 'discarded',
    }"
    :data-testid="`suggestion-row-${fieldKey}`"
  >
    <div class="flex items-start justify-between gap-4">
      <!-- Field info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm font-medium text-secondary">{{ label }}</span>
          <span
            v-if="status !== 'pending'"
            class="text-xs px-1.5 py-0.5 rounded font-medium"
            :class="{
              'bg-success text-inverted': status === 'accepted',
              'bg-info text-inverted': status === 'edited',
              'bg-surface text-muted border border-default': status === 'discarded',
            }"
          >
            {{ status }}
          </span>
        </div>

        <!-- AI suggested value -->
        <div v-if="!isEditing" class="text-sm">
          <span v-if="aiValue" class="text-primary break-words">{{ aiValue }}</span>
          <span v-else class="text-muted italic">No suggestion</span>
        </div>

        <!-- Current value when accepted/edited/discarded -->
        <div
          v-if="!isEditing && status === 'edited' && modelValue && modelValue !== aiValue"
          class="text-xs text-muted mt-1"
        >
          Edited to: <span class="text-primary">{{ modelValue }}</span>
        </div>

        <!-- Inline editor -->
        <div v-if="isEditing" class="mt-2">
          <textarea
            v-if="isLongField"
            v-model="editBuffer"
            rows="3"
            class="w-full border border-default rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus"
            :data-testid="`edit-textarea-${fieldKey}`"
          />
          <input
            v-else
            v-model="editBuffer"
            type="text"
            class="w-full border border-default rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            :data-testid="`edit-input-${fieldKey}`"
          />
          <div class="flex gap-2 mt-2">
            <button
              type="button"
              class="px-3 py-1 bg-interactive text-inverted rounded text-xs"
              :data-testid="`save-edit-${fieldKey}`"
              @click="handleSaveEdit"
            >
              Save
            </button>
            <button
              type="button"
              class="px-3 py-1 border border-default rounded text-xs text-secondary"
              :data-testid="`cancel-edit-${fieldKey}`"
              @click="handleCancelEdit"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div v-if="!isEditing" class="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title="Accept AI suggestion"
          class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
          :class="
            status === 'accepted'
              ? 'bg-success text-inverted'
              : 'bg-surface border border-default hover:bg-success-subtle hover:border-success text-secondary'
          "
          :data-testid="`accept-${fieldKey}`"
          @click="handleAccept"
        >
          Accept
        </button>
        <button
          type="button"
          title="Edit value"
          class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
          :class="
            status === 'edited'
              ? 'bg-info text-inverted'
              : 'bg-surface border border-default hover:bg-info-subtle hover:border-info text-secondary'
          "
          :data-testid="`edit-${fieldKey}`"
          @click="handleEdit"
        >
          Edit
        </button>
        <button
          type="button"
          title="Discard suggestion"
          class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
          :class="
            status === 'discarded'
              ? 'bg-surface text-muted border border-default'
              : 'bg-surface border border-default hover:bg-critical-subtle hover:border-critical text-secondary'
          "
          :data-testid="`discard-${fieldKey}`"
          @click="handleDiscard"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
</template>
