<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAdminUserDetail, useAdminSetUserRole, useAdminSetUserTier } from "../../api/queries/admin";

const route = useRoute();
const router = useRouter();
const userId = computed(() => route.params.id as string);

const { data, isLoading } = useAdminUserDetail(userId);
const { mutate: setRole, isPending: rolePending } = useAdminSetUserRole();
const { mutate: setTier, isPending: tierPending } = useAdminSetUserTier();

const selectedRole = ref("");
const selectedTier = ref<number>(1);

function initForm() {
  if (data.value) {
    const u = data.value as Record<string, unknown>;
    selectedRole.value = u.role as string;
    selectedTier.value = (u.tier as number) ?? 1;
  }
}

function saveRole() {
  setRole({ id: userId.value, role: selectedRole.value });
}

function saveTier() {
  setTier({ id: userId.value, tierId: selectedTier.value });
}
</script>

<template>
  <div class="p-8 space-y-6">
    <div class="flex items-center gap-4">
      <button
        class="text-sm text-muted hover:underline"
        @click="router.push('/admin/users')"
      >
        ← Back to Users
      </button>
    </div>

    <h1 class="text-2xl font-semibold text-primary">User Detail</h1>

    <div v-if="isLoading" class="text-muted text-sm">Loading...</div>
    <div v-else-if="data" class="space-y-6" @vue:mounted="initForm()">
      <!-- User Info -->
      <section class="bg-elevated rounded-lg p-6 space-y-3">
        <h2 class="text-lg font-medium text-primary">Account</h2>
        <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <span class="text-muted">Name</span>
          <span class="text-primary">{{ (data as Record<string, unknown>).name as string ?? "—" }}</span>
          <span class="text-muted">Email</span>
          <span class="text-primary">{{ (data as Record<string, unknown>).email as string }}</span>
          <span class="text-muted">Documents</span>
          <span class="text-primary">{{ (data as Record<string, unknown>).documentCount as number }}</span>
        </div>
      </section>

      <!-- Role Change -->
      <section class="bg-elevated rounded-lg p-6 space-y-4">
        <h2 class="text-lg font-medium text-primary">Role</h2>
        <div class="flex gap-3 items-center">
          <select
            v-model="selectedRole"
            class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
          >
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <button
            class="px-4 py-2 rounded border border-default text-primary text-sm hover:bg-surface-subtle disabled:opacity-50"
            :disabled="rolePending"
            @click="saveRole"
          >
            {{ rolePending ? "Saving..." : "Save Role" }}
          </button>
        </div>
      </section>

      <!-- Tier Change -->
      <section class="bg-elevated rounded-lg p-6 space-y-4">
        <h2 class="text-lg font-medium text-primary">Tier</h2>
        <div class="flex gap-3 items-center">
          <input
            v-model.number="selectedTier"
            type="number"
            min="1"
            class="w-24 px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
          />
          <button
            class="px-4 py-2 rounded border border-default text-primary text-sm hover:bg-surface-subtle disabled:opacity-50"
            :disabled="tierPending"
            @click="saveTier"
          >
            {{ tierPending ? "Saving..." : "Save Tier" }}
          </button>
        </div>
      </section>
    </div>
    <div v-else class="text-muted text-sm">User not found.</div>
  </div>
</template>
