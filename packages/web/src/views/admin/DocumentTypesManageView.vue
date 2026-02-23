<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import type { DocumentCategoryRecord } from "@opo/shared";
import CategoryForm from "../../components/forms/CategoryForm.vue";
import FieldDefinitionForm from "../../components/forms/FieldDefinitionForm.vue";
import AssociationRulesManager from "../../components/admin/AssociationRulesManager.vue";
import {
  useCategoryList,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCategoryFields,
  useCreateFieldDefinition,
  useDeleteFieldDefinition,
  usePolicyTypeList,
  useCreatePolicyType,
  useDeletePolicyType,
} from "../../api/queries/categories";
import { computed } from "vue";

// --- Tab state ---
const activeTab = ref<"categories" | "policy-types">("categories");

// --- Categories ---
const { data: categories, isLoading: categoriesLoading } = useCategoryList();
const { mutate: createCategory } = useCreateCategory();
const { mutate: updateCategory } = useUpdateCategory();
const { mutate: deleteCategory } = useDeleteCategory();

const showCategoryDialog = ref(false);
const editingCategory = ref<DocumentCategoryRecord | null>(null);
const selectedCategory = ref<DocumentCategoryRecord | null>(null);

function openCreateCategory() {
  editingCategory.value = null;
  showCategoryDialog.value = true;
}

function openEditCategory(cat: DocumentCategoryRecord) {
  editingCategory.value = cat;
  showCategoryDialog.value = true;
}

function onCategorySubmit(data: unknown) {
  if (editingCategory.value) {
    updateCategory({ id: editingCategory.value.id, ...(data as Record<string, unknown>) });
  } else {
    createCategory(data);
  }
  showCategoryDialog.value = false;
}

function onDeleteCategory(cat: DocumentCategoryRecord) {
  if (confirm(`Delete category "${cat.name}"?`)) {
    deleteCategory(cat.id);
    if (selectedCategory.value?.id === cat.id) {
      selectedCategory.value = null;
    }
  }
}

// --- Fields for selected category ---
const selectedCategoryId = computed(() => selectedCategory.value?.id ?? "");
const { data: fields } = useCategoryFields(selectedCategoryId);
const { mutate: createField } = useCreateFieldDefinition();
const { mutate: deleteField } = useDeleteFieldDefinition();

const showFieldDialog = ref(false);

function openAddField() {
  showFieldDialog.value = true;
}

function onFieldSubmit(data: unknown) {
  if (!selectedCategory.value) return;
  createField({ categoryId: selectedCategory.value.id, ...(data as Record<string, unknown>) });
  showFieldDialog.value = false;
}

function onDeleteField(fieldId: string) {
  if (!selectedCategory.value) return;
  if (confirm("Delete this field definition?")) {
    deleteField({ id: fieldId, categoryId: selectedCategory.value.id });
  }
}

// --- Policy Types ---
const { data: policyTypes, isLoading: policyTypesLoading } = usePolicyTypeList();
const { mutate: createPolicyType } = useCreatePolicyType();
const { mutate: deletePolicyType } = useDeletePolicyType();

const newPolicyTypeName = ref("");

function onAddPolicyType() {
  const name = newPolicyTypeName.value.trim();
  if (!name) return;
  createPolicyType({ name });
  newPolicyTypeName.value = "";
}

function onDeletePolicyType(id: string) {
  if (confirm("Delete this policy type?")) {
    deletePolicyType(id);
  }
}
</script>

<template>
  <div class="p-8 flex flex-col gap-6">
    <h1 class="text-2xl font-semibold text-primary">Document Types Management</h1>

    <!-- Tab nav -->
    <div class="flex gap-4 border-b border-default">
      <button
        class="pb-2 text-sm font-medium"
        :class="activeTab === 'categories' ? 'border-b-2 border-primary text-primary' : 'text-muted'"
        @click="activeTab = 'categories'"
      >
        Categories
      </button>
      <button
        class="pb-2 text-sm font-medium"
        :class="activeTab === 'policy-types' ? 'border-b-2 border-primary text-primary' : 'text-muted'"
        @click="activeTab = 'policy-types'"
      >
        Policy Types
      </button>
    </div>

    <!-- Categories Tab -->
    <div v-if="activeTab === 'categories'" class="flex flex-col gap-6">
      <div class="flex justify-end">
        <Button label="Add Category" icon="pi pi-plus" @click="openCreateCategory" />
      </div>

      <DataTable
        :value="categories ?? []"
        :loading="categoriesLoading"
        selection-mode="single"
        v-model:selection="selectedCategory"
        data-key="id"
        class="w-full"
      >
        <Column field="id" header="ID" />
        <Column field="name" header="Name" />
        <Column field="description" header="Description" />
        <Column header="Actions">
          <template #body="{ data: cat }">
            <div class="flex gap-2">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                size="small"
                @click="openEditCategory(cat as DocumentCategoryRecord)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                size="small"
                @click="onDeleteCategory(cat as DocumentCategoryRecord)"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <!-- Selected category details -->
      <div v-if="selectedCategory" class="flex flex-col gap-6 border border-default rounded-lg p-6">
        <h2 class="text-lg font-semibold">{{ selectedCategory.name }}</h2>

        <!-- Field Definitions -->
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-medium">Field Definitions</h3>
            <Button label="Add Field" icon="pi pi-plus" size="small" @click="openAddField" />
          </div>

          <div v-if="fields && fields.length > 0" class="flex flex-col gap-2">
            <div
              v-for="field in fields"
              :key="field.id"
              class="flex items-center justify-between p-3 border border-default rounded"
            >
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ field.displayName }}</span>
                <span class="text-xs text-muted">{{ field.fieldKey }} · {{ field.valueType }}</span>
              </div>
              <Button
                icon="pi pi-trash"
                severity="danger"
                size="small"
                @click="onDeleteField(field.id)"
              />
            </div>
          </div>
          <p v-else class="text-sm text-muted">No fields defined yet.</p>
        </div>

        <!-- Association Rules -->
        <AssociationRulesManager :category-id="selectedCategory.id" />
      </div>
    </div>

    <!-- Policy Types Tab -->
    <div v-if="activeTab === 'policy-types'" class="flex flex-col gap-4">
      <div class="flex gap-2">
        <InputText v-model="newPolicyTypeName" placeholder="Policy type name" class="flex-1" />
        <Button label="Add" icon="pi pi-plus" @click="onAddPolicyType" />
      </div>

      <div v-if="policyTypesLoading" class="text-sm text-muted">Loading...</div>
      <div v-else-if="policyTypes && policyTypes.length > 0" class="flex flex-col gap-2">
        <div
          v-for="pt in policyTypes"
          :key="pt.id"
          class="flex items-center justify-between p-3 border border-default rounded"
        >
          <span class="text-sm font-medium">{{ pt.name }}</span>
          <Button
            icon="pi pi-trash"
            severity="danger"
            size="small"
            @click="onDeletePolicyType(pt.id)"
          />
        </div>
      </div>
      <p v-else class="text-sm text-muted">No policy types yet.</p>
    </div>

    <!-- Category Dialog -->
    <Dialog v-model:visible="showCategoryDialog" :header="editingCategory ? 'Edit Category' : 'New Category'" modal>
      <CategoryForm
        :model-value="editingCategory"
        @submit="onCategorySubmit"
        @cancel="showCategoryDialog = false"
      />
    </Dialog>

    <!-- Field Dialog -->
    <Dialog v-model:visible="showFieldDialog" header="Add Field Definition" modal>
      <FieldDefinitionForm
        v-if="selectedCategory"
        :category-id="selectedCategory.id"
        @submit="onFieldSubmit"
        @cancel="showFieldDialog = false"
      />
    </Dialog>
  </div>
</template>
