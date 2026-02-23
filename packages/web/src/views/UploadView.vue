<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import FileDropzone from "../components/documents/FileDropzone.vue";
import TagInput from "../components/shared/TagInput.vue";
import PlaceAutocomplete from "../components/locations/PlaceAutocomplete.vue";
import TribeAutocomplete from "../components/locations/TribeAutocomplete.vue";
import CountyAutocomplete from "../components/locations/CountyAutocomplete.vue";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import DatePicker from "primevue/datepicker";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Button from "primevue/button";
import { useUploadWizardStore } from "../stores/upload-wizard";
import { useInitiateUpload, useConfirmUpload } from "../api/queries/documents";
import type { Place, Tribe } from "@opo/shared";

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
const wizardStore = useUploadWizardStore();
const initiateUpload = useInitiateUpload();
const confirmUpload = useConfirmUpload();

const isSubmitting = computed(
  () => initiateUpload.isPending.value || confirmUpload.isPending.value,
);
const error = computed(
  () =>
    (initiateUpload.error.value as Error | null)?.message ??
    (confirmUpload.error.value as Error | null)?.message ??
    null,
);

function onFileSelect(file: File) {
  wizardStore.setFile(file);
  if (!wizardStore.formData.title) {
    wizardStore.updateFormData({ title: file.name.replace(/\.[^.]+$/, "") });
  }
}

function onFileError(message: string) {
  console.error("File error:", message);
}

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
  const file = wizardStore.file;
  if (!file) return;

  const formData = wizardStore.formData;
  const title = formData.title ?? file.name;

  try {
    const result = await initiateUpload.mutateAsync({
      title,
      filename: file.name,
      mimetype: file.type,
      size: file.size,
      description: formData.description as string | undefined,
      documentDate: formData.documentDate as string | undefined,
      governmentLevel: formData.governmentLevel as
        | "federal"
        | "state"
        | "county"
        | "place"
        | "tribal"
        | undefined,
      stateUsps: formData.stateUsps as string | undefined,
      placeGeoid: formData.placeGeoid as string | undefined,
      tribeId: formData.tribeId as string | undefined,
      category: formData.category as string | undefined,
      tags: formData.tags as string[] | undefined,
      saveAsDraft: formData.saveAsDraft as boolean | undefined,
    });

    wizardStore.setUploadResult(result.documentId, result.objectKey);

    // Upload file to S3
    await uploadToS3(result.presignedUrl, result.presignedFields, file);

    // Confirm upload
    await confirmUpload.mutateAsync({
      id: result.documentId,
      saveAsDraft: formData.saveAsDraft as boolean | undefined,
    });

    wizardStore.reset();

    if (formData.saveAsDraft) {
      router.push("/my-uploads");
    } else {
      router.push(`/documents/${result.documentId}`);
    }
  } catch (err) {
    console.error("Upload failed:", err);
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-2xl font-semibold text-primary mb-6">Upload Document</h1>

    <!-- Step indicators -->
    <div class="flex gap-2 mb-8">
      <div
        v-for="(stepLabel, i) in ['File', 'Metadata', 'Location', 'Review']"
        :key="i"
        class="flex-1 text-center text-sm py-1 rounded"
        :class="
          wizardStore.step === ['file', 'metadata', 'location', 'review'][i]
            ? 'bg-interactive text-inverted'
            : 'bg-sunken text-muted'
        "
      >
        {{ stepLabel }}
      </div>
    </div>

    <!-- Step 1: File -->
    <div v-if="wizardStore.step === 'file'" class="space-y-4">
      <FileDropzone
        :accept="ALLOWED_MIMETYPES"
        :max-size="MAX_SIZE"
        @select="onFileSelect"
        @error="onFileError"
      />
      <div class="flex justify-end">
        <Button label="Next" :disabled="!wizardStore.file" @click="wizardStore.nextStep()" />
      </div>
    </div>

    <!-- Step 2: Metadata -->
    <div v-else-if="wizardStore.step === 'metadata'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary mb-1">Title *</label>
        <InputText
          :model-value="wizardStore.formData.title ?? ''"
          @update:model-value="wizardStore.updateFormData({ title: $event })"
          class="w-full"
          placeholder="Document title"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary mb-1">Description</label>
        <Textarea
          :model-value="wizardStore.formData.description ?? ''"
          @update:model-value="wizardStore.updateFormData({ description: $event })"
          class="w-full"
          rows="3"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary mb-1">Document Date</label>
        <DatePicker
          :model-value="wizardStore.formData.documentDate ? new Date(wizardStore.formData.documentDate as string) : null"
          @update:model-value="(v) => wizardStore.updateFormData({ documentDate: v instanceof Date ? v.toISOString().split('T')[0] : undefined })"
          class="w-full"
          date-format="yy-mm-dd"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-secondary mb-1">Tags</label>
        <TagInput
          :model-value="(wizardStore.formData.tags as string[]) ?? []"
          @update:model-value="wizardStore.updateFormData({ tags: $event })"
        />
      </div>

      <div class="flex items-center gap-2">
        <Checkbox
          input-id="saveAsDraft"
          :model-value="(wizardStore.formData.saveAsDraft as boolean) ?? false"
          :binary="true"
          @update:model-value="wizardStore.updateFormData({ saveAsDraft: $event })"
        />
        <label for="saveAsDraft" class="text-sm text-secondary">Save as draft</label>
      </div>

      <div class="flex justify-between">
        <Button label="Back" severity="secondary" @click="wizardStore.prevStep()" />
        <Button label="Next" :disabled="!wizardStore.formData.title" @click="wizardStore.nextStep()" />
      </div>
    </div>

    <!-- Step 3: Location -->
    <div v-else-if="wizardStore.step === 'location'" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-secondary mb-1">Government Level</label>
        <Select
          :model-value="wizardStore.formData.governmentLevel ?? null"
          :options="[
            { label: 'Federal', value: 'federal' },
            { label: 'State', value: 'state' },
            { label: 'County', value: 'county' },
            { label: 'Place', value: 'place' },
            { label: 'Tribal', value: 'tribal' },
          ]"
          option-label="label"
          option-value="value"
          placeholder="None"
          show-clear
          class="w-full"
          @update:model-value="(v) => wizardStore.updateFormData({
            governmentLevel: v ?? undefined,
            placeGeoid: undefined,
            stateUsps: undefined,
            tribeId: undefined,
          })"
        />
      </div>

      <div
        v-if="
          wizardStore.formData.governmentLevel === 'state' ||
          wizardStore.formData.governmentLevel === 'county' ||
          wizardStore.formData.governmentLevel === 'place'
        "
      >
        <label class="block text-sm font-medium text-secondary mb-1">State (USPS)</label>
        <InputText
          maxlength="2"
          :model-value="wizardStore.formData.stateUsps ?? ''"
          @update:model-value="(v: string | undefined) => wizardStore.updateFormData({
            stateUsps: v ? v.toUpperCase() || undefined : undefined,
            placeGeoid: undefined,
          })"
          class="w-full uppercase"
          placeholder="e.g. CA"
        />
      </div>

      <div
        v-if="
          wizardStore.formData.governmentLevel === 'county' &&
          wizardStore.formData.stateUsps
        "
      >
        <label class="block text-sm font-medium text-secondary mb-1">County</label>
        <CountyAutocomplete
          :state-usps="(wizardStore.formData.stateUsps as string)"
          placeholder="Search for a county…"
          @select="(place: Place) => wizardStore.updateFormData({ placeGeoid: place.geoid })"
          @clear="wizardStore.updateFormData({ placeGeoid: undefined })"
        />
      </div>

      <div
        v-if="
          wizardStore.formData.governmentLevel === 'place' &&
          wizardStore.formData.stateUsps
        "
      >
        <label class="block text-sm font-medium text-secondary mb-1">Place</label>
        <PlaceAutocomplete
          :state-usps="(wizardStore.formData.stateUsps as string)"
          placeholder="Search for a city or town…"
          @select="(place: Place) => wizardStore.updateFormData({ placeGeoid: place.geoid })"
          @clear="wizardStore.updateFormData({ placeGeoid: undefined })"
        />
      </div>

      <div v-if="wizardStore.formData.governmentLevel === 'tribal'">
        <label class="block text-sm font-medium text-secondary mb-1">Tribal Nation</label>
        <TribeAutocomplete
          placeholder="Search for a tribal nation…"
          @select="(tribe: Tribe) => wizardStore.updateFormData({ tribeId: tribe.id })"
          @clear="wizardStore.updateFormData({ tribeId: undefined })"
        />
      </div>

      <div class="flex justify-between">
        <Button label="Back" severity="secondary" @click="wizardStore.prevStep()" />
        <Button label="Next" :disabled="!wizardStore.formData.title" @click="wizardStore.nextStep()" />
      </div>
    </div>

    <!-- Step 4: Review -->
    <div v-else-if="wizardStore.step === 'review'" class="space-y-4">
      <dl class="space-y-2 text-sm">
        <div class="flex gap-4">
          <dt class="font-medium text-secondary w-32">File</dt>
          <dd class="text-primary">{{ wizardStore.file?.name }}</dd>
        </div>
        <div class="flex gap-4">
          <dt class="font-medium text-secondary w-32">Title</dt>
          <dd class="text-primary">{{ wizardStore.formData.title }}</dd>
        </div>
        <div v-if="wizardStore.formData.description" class="flex gap-4">
          <dt class="font-medium text-secondary w-32">Description</dt>
          <dd class="text-primary">{{ wizardStore.formData.description }}</dd>
        </div>
        <div v-if="wizardStore.formData.governmentLevel" class="flex gap-4">
          <dt class="font-medium text-secondary w-32">Gov Level</dt>
          <dd class="text-primary">{{ wizardStore.formData.governmentLevel }}</dd>
        </div>
        <div v-if="(wizardStore.formData.tags as string[] | undefined)?.length" class="flex gap-4">
          <dt class="font-medium text-secondary w-32">Tags</dt>
          <dd class="text-primary">{{ (wizardStore.formData.tags as string[]).join(", ") }}</dd>
        </div>
        <div class="flex gap-4">
          <dt class="font-medium text-secondary w-32">Mode</dt>
          <dd class="text-primary">
            {{ wizardStore.formData.saveAsDraft ? "Save as draft" : "Submit for review" }}
          </dd>
        </div>
      </dl>

      <p v-if="error" class="text-critical text-sm" role="alert">{{ error }}</p>

      <div class="flex justify-between">
        <Button label="Back" severity="secondary" :disabled="isSubmitting" @click="wizardStore.prevStep()" />
        <Button
          :label="isSubmitting ? 'Uploading…' : wizardStore.formData.saveAsDraft ? 'Save Draft' : 'Submit'"
          :loading="isSubmitting"
          @click="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>
