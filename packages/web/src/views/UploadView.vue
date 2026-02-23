<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import ToggleSwitch from "primevue/toggleswitch";
import Button from "primevue/button";
import FileDropzone from "../components/documents/FileDropzone.vue";
import DcSearchPanel from "../components/upload/DcSearchPanel.vue";
import DocumentSourceAutocomplete from "../components/upload/DocumentSourceAutocomplete.vue";
import { useUploadWizardStore } from "../stores/upload-wizard";
import { useInitiateUpload, useConfirmUpload, useImportFromDc } from "../api/queries/documents";
import { useProfile } from "../api/queries/profile";

const ALLOWED_MIMETYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const MAX_SIZE = 50 * 1024 * 1024;

const router = useRouter();
const store = useUploadWizardStore();
const initiateUpload = useInitiateUpload();
const confirmUpload = useConfirmUpload();
const importFromDc = useImportFromDc();
const { data: profile } = useProfile();

const activeTab = ref<"file" | "dc">("file");

const isSubmitting = computed(
  () =>
    initiateUpload.isPending.value ||
    confirmUpload.isPending.value ||
    importFromDc.isPending.value,
);

const error = computed(
  () =>
    (initiateUpload.error.value as Error | null)?.message ??
    (confirmUpload.error.value as Error | null)?.message ??
    (importFromDc.error.value as Error | null)?.message ??
    null,
);

async function uploadToS3(
  url: string,
  fields: Record<string, string>,
  file: File,
): Promise<void> {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.append(k, v);
  formData.append("file", file);
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) throw new Error("S3 upload failed");
}

async function handleSubmit() {
  const documentSource = store.documentSource;
  if (!documentSource) return;

  try {
    if (store.file) {
      const file = store.file;

      const result = await initiateUpload.mutateAsync({
        title: file.name.replace(/\.[^.]+$/, ""),
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        governmentLevel: documentSource.governmentLevel,
        stateUsps: documentSource.stateUsps,
        placeGeoid: documentSource.placeGeoid,
        tribeId: documentSource.tribeId,
        useAi: store.useAi,
      });

      await uploadToS3(result.presignedUrl, result.presignedFields, file);

      await confirmUpload.mutateAsync({ id: result.documentId });

      store.reset();
      router.push(`/documents/${result.documentId}`);
    } else if (store.dcSelection) {
      const governmentLevel = documentSource.governmentLevel;

      const result = await importFromDc.mutateAsync({
        documentCloudId: store.dcSelection.documentCloudId,
        governmentLevel,
        stateUsps: documentSource.stateUsps,
        placeGeoid: documentSource.placeGeoid,
        tribeId: documentSource.tribeId,
        useAi: store.useAi,
      });

      store.reset();
      router.push(`/documents/${result.documentId}`);
    }
  } catch (err) {
    console.error("Upload failed:", err);
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-8 px-4">
    <h1 class="text-2xl font-semibold text-primary mb-6">Upload Document</h1>

    <!-- Source tabs -->
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="file">Upload File</Tab>
        <Tab value="dc">Import from DocumentCloud</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="file" class="pt-4">
          <FileDropzone
            :accept="ALLOWED_MIMETYPES"
            :max-size="MAX_SIZE"
            @select="store.setFile"
          />
          <p v-if="store.file" class="mt-2 text-sm text-muted">
            Selected: <span class="text-primary font-medium">{{ store.file.name }}</span>
          </p>
        </TabPanel>
        <TabPanel value="dc" class="pt-4">
          <DcSearchPanel @selected="(dc) => store.setDcSelection(dc)" />
          <p v-if="store.dcSelection" class="mt-2 text-sm text-muted">
            Selected:
            <span class="text-primary font-medium">{{ store.dcSelection.title }}</span>
          </p>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Document Source -->
    <div class="mt-6">
      <label class="block text-sm font-medium text-secondary mb-2">
        Document Source <span class="text-red-500">*</span>
      </label>
      <DocumentSourceAutocomplete v-model="store.documentSource" />
    </div>

    <!-- AI toggle (only when available) -->
    <div
      v-if="profile?.aiSuggestions?.available"
      class="mt-4 flex items-center gap-3"
    >
      <ToggleSwitch v-model="store.useAi" input-id="ai-toggle" />
      <label for="ai-toggle" class="text-sm text-secondary cursor-pointer">
        Analyze with AI
      </label>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-4 text-sm text-critical" role="alert">{{ error }}</p>

    <!-- Submit -->
    <Button
      label="Upload"
      :disabled="!store.canSubmit || isSubmitting"
      :loading="isSubmitting"
      class="mt-6"
      @click="handleSubmit"
    />
  </div>
</template>
