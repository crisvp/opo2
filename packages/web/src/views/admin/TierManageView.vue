<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Dialog from "primevue/dialog";
import Tag from "primevue/tag";
import { useToast } from "primevue/usetoast";

import type { Tier, CreateTierInput, UpdateTierInput, UpdateTierLimitsInput } from "@opo/shared";
import {
  useTierList,
  useTierDetail,
  useCreateTier,
  useUpdateTier,
  useDeleteTier,
  useUpdateTierLimits,
} from "../../api/queries/tiers";
import TierForm from "../../components/forms/TierForm.vue";

const toast = useToast();

const { data: tiersData, isLoading: isListLoading } = useTierList();
const tiers = computed<Tier[]>(() => (tiersData.value as Tier[] | undefined) ?? []);

// Create dialog
const showCreateDialog = ref(false);
const { mutate: createTier, isPending: isCreating } = useCreateTier();

function handleCreate(values: CreateTierInput | UpdateTierInput) {
  createTier(values as CreateTierInput, {
    onSuccess: () => {
      showCreateDialog.value = false;
      toast.add({ severity: "success", summary: "Tier created", life: 3000 });
    },
    onError: (err) => {
      toast.add({ severity: "error", summary: "Failed to create tier", detail: (err as Error).message, life: 5000 });
    },
  });
}

// Edit dialog
const showEditDialog = ref(false);
const editingTierId = ref("");

const { data: detailData } = useTierDetail(editingTierId);
const editingTier = computed<Tier | null>(() => (detailData.value as Tier | null | undefined) ?? null);

const { mutate: updateTier, isPending: isUpdating } = useUpdateTier();

function openEdit(tier: Tier) {
  editingTierId.value = String(tier.id);
  showEditDialog.value = true;
}

function handleUpdate(values: CreateTierInput | UpdateTierInput) {
  updateTier(
    { id: editingTierId.value, ...(values as UpdateTierInput) },
    {
      onSuccess: () => {
        showEditDialog.value = false;
        toast.add({ severity: "success", summary: "Tier updated", life: 3000 });
      },
      onError: (err) => {
        toast.add({ severity: "error", summary: "Failed to update tier", detail: (err as Error).message, life: 5000 });
      },
    },
  );
}

// Limits editor
const showLimitsDialog = ref(false);
const editingLimitsTierId = ref("");
const editingLimitsTier = ref<Tier | null>(null);
const limitsInput = ref<{ limitType: string; limitValue: number }[]>([]);

const { mutate: updateTierLimits, isPending: isUpdatingLimits } = useUpdateTierLimits();

function openLimitsEditor(tier: Tier) {
  editingLimitsTierId.value = String(tier.id);
  editingLimitsTier.value = tier;
  limitsInput.value = tier.limits.map((l) => ({ limitType: l.limitType, limitValue: l.limitValue }));
  showLimitsDialog.value = true;
}

function addLimitRow() {
  limitsInput.value.push({ limitType: "", limitValue: 0 });
}

function removeLimitRow(idx: number) {
  limitsInput.value.splice(idx, 1);
}

function saveLimits() {
  const payload: UpdateTierLimitsInput = { limits: [...limitsInput.value] };
  updateTierLimits(
    { id: editingLimitsTierId.value, ...payload },
    {
      onSuccess: () => {
        showLimitsDialog.value = false;
        toast.add({ severity: "success", summary: "Limits updated", life: 3000 });
      },
      onError: (err) => {
        toast.add({ severity: "error", summary: "Failed to update limits", detail: (err as Error).message, life: 5000 });
      },
    },
  );
}

// Delete
const { mutate: deleteTier } = useDeleteTier();

function handleDelete(tier: Tier) {
  if (!confirm(`Delete tier "${tier.name}"? This cannot be undone.`)) return;
  deleteTier(String(tier.id), {
    onSuccess: () => {
      toast.add({ severity: "success", summary: "Tier deleted", life: 3000 });
    },
    onError: (err) => {
      toast.add({ severity: "error", summary: "Failed to delete tier", detail: (err as Error).message, life: 5000 });
    },
  });
}
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-primary">Tier Management</h1>
        <p class="mt-1 text-sm text-muted">Manage user tiers and their upload/usage limits.</p>
      </div>
      <Button
        label="Add Tier"
        icon="pi pi-plus"
        @click="showCreateDialog = true"
      />
    </div>

    <!-- Table -->
    <DataTable
      :value="tiers"
      :loading="isListLoading"
      data-key="id"
      class="rounded border border-subtle"
    >
      <Column field="id" header="ID" class="w-16" />
      <Column field="name" header="Name" class="font-medium text-primary" />
      <Column field="description" header="Description">
        <template #body="{ data: row }">
          <span class="text-muted">{{ (row as Tier).description ?? "—" }}</span>
        </template>
      </Column>
      <Column header="Default">
        <template #body="{ data: row }">
          <Tag
            v-if="(row as Tier).isDefault"
            value="Default"
            severity="success"
          />
          <span v-else class="text-muted">—</span>
        </template>
      </Column>
      <Column header="Limits">
        <template #body="{ data: row }">
          <span class="text-sm text-muted">{{ (row as Tier).limits.length }} limit(s)</span>
        </template>
      </Column>
      <Column header="Actions">
        <template #body="{ data: row }">
          <div class="flex gap-2">
            <Button
              icon="pi pi-list"
              severity="secondary"
              text
              size="small"
              aria-label="Edit limits"
              @click="openLimitsEditor(row as Tier)"
            />
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              text
              size="small"
              aria-label="Edit tier"
              @click="openEdit(row as Tier)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              size="small"
              aria-label="Delete tier"
              @click="handleDelete(row as Tier)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Create Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      header="Create Tier"
      modal
      :style="{ width: '480px' }"
    >
      <TierForm
        :loading="isCreating"
        @submit="handleCreate"
        @cancel="showCreateDialog = false"
      />
    </Dialog>

    <!-- Edit Dialog -->
    <Dialog
      v-model:visible="showEditDialog"
      header="Edit Tier"
      modal
      :style="{ width: '480px' }"
    >
      <div v-if="editingTier">
        <TierForm
          :model-value="editingTier"
          :loading="isUpdating"
          @submit="handleUpdate"
          @cancel="showEditDialog = false"
        />
      </div>
      <div v-else class="flex items-center justify-center py-8">
        <span class="text-muted">Loading…</span>
      </div>
    </Dialog>

    <!-- Limits Editor Dialog -->
    <Dialog
      v-model:visible="showLimitsDialog"
      :header="`Edit Limits — ${editingLimitsTier?.name ?? ''}`"
      modal
      :style="{ width: '480px' }"
    >
      <div class="flex flex-col gap-4">
        <div
          v-for="(limit, idx) in limitsInput"
          :key="idx"
          class="flex items-center gap-2"
        >
          <input
            v-model="limit.limitType"
            type="text"
            placeholder="uploads"
            class="flex-1 rounded border border-default p-2 text-sm"
          />
          <input
            v-model.number="limit.limitValue"
            type="number"
            :min="0"
            class="w-24 rounded border border-default p-2 text-sm"
          />
          <Button
            type="button"
            icon="pi pi-trash"
            severity="danger"
            size="small"
            @click="removeLimitRow(idx)"
          />
        </div>
        <Button
          type="button"
          label="Add Limit"
          severity="secondary"
          size="small"
          icon="pi pi-plus"
          @click="addLimitRow"
        />
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            @click="showLimitsDialog = false"
          />
          <Button
            type="button"
            label="Save"
            :loading="isUpdatingLimits"
            @click="saveLimits"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>
