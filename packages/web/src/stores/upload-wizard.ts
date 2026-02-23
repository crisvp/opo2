import { defineStore } from "pinia";
import { ref } from "vue";
import type { z } from "zod";
import type { createDocumentSchema } from "@opo/shared";

type DocumentFormData = Partial<z.infer<typeof createDocumentSchema>>;

type UploadStep = "file" | "metadata" | "location" | "review";

export const useUploadWizardStore = defineStore("uploadWizard", () => {
  const step = ref<UploadStep>("file");
  const file = ref<File | null>(null);
  const documentId = ref<string | null>(null);
  const s3Key = ref<string | null>(null);
  const formData = ref<DocumentFormData>({});

  function setFile(f: File) {
    file.value = f;
  }

  function setUploadResult(id: string, key: string) {
    documentId.value = id;
    s3Key.value = key;
  }

  function updateFormData(data: Partial<DocumentFormData>) {
    formData.value = { ...formData.value, ...data };
  }

  function nextStep() {
    const steps: UploadStep[] = ["file", "metadata", "location", "review"];
    const current = steps.indexOf(step.value);
    if (current < steps.length - 1) {
      step.value = steps[current + 1];
    }
  }

  function prevStep() {
    const steps: UploadStep[] = ["file", "metadata", "location", "review"];
    const current = steps.indexOf(step.value);
    if (current > 0) {
      step.value = steps[current - 1];
    }
  }

  function reset() {
    step.value = "file";
    file.value = null;
    documentId.value = null;
    s3Key.value = null;
    formData.value = {};
  }

  return {
    step,
    file,
    documentId,
    s3Key,
    formData,
    setFile,
    setUploadResult,
    updateFormData,
    nextStep,
    prevStep,
    reset,
  };
});
