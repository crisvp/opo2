import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { LocationSelection } from "../components/upload/DocumentSourceAutocomplete.vue";

interface DcSelection {
  documentCloudId: number;
  title: string;
}

export const useUploadWizardStore = defineStore("upload-wizard", () => {
  const file = ref<File | null>(null);
  const dcSelection = ref<DcSelection | null>(null);
  const documentSource = ref<LocationSelection | null>(null);
  const useAi = ref(true);

  function reset() {
    file.value = null;
    dcSelection.value = null;
    documentSource.value = null;
  }

  function setFile(f: File) {
    file.value = f;
    dcSelection.value = null;
  }

  function setDcSelection(dc: DcSelection) {
    dcSelection.value = dc;
    file.value = null;
  }

  const canSubmit = computed(
    () => !!(file.value || dcSelection.value) && documentSource.value !== null,
  );

  return { file, dcSelection, documentSource, useAi, reset, setFile, setDcSelection, canSubmit };
});
