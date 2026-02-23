<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAdminUserList } from "../../api/queries/admin";

const router = useRouter();
const search = ref("");
const roleFilter = ref("");
const page = ref(1);
const pageSize = ref(20);

const filters = computed(() => ({
  search: search.value || undefined,
  role: roleFilter.value || undefined,
  page: page.value,
  pageSize: pageSize.value,
}));

const { data, isLoading } = useAdminUserList(filters);

const roleOptions = [
  { label: "All Roles", value: "" },
  { label: "Admin", value: "admin" },
  { label: "Moderator", value: "moderator" },
  { label: "User", value: "user" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}
</script>

<template>
  <div class="p-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-primary">Users</h1>
    </div>

    <!-- Filters -->
    <div class="flex gap-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or email..."
        class="flex-1 max-w-sm px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
      />
      <select
        v-model="roleFilter"
        class="px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
      >
        <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="isLoading" class="text-muted text-sm">Loading...</div>
    <div v-else-if="data">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left py-2 px-3 text-muted font-medium">Name</th>
            <th class="text-left py-2 px-3 text-muted font-medium">Email</th>
            <th class="text-left py-2 px-3 text-muted font-medium">Role</th>
            <th class="text-left py-2 px-3 text-muted font-medium">Tier</th>
            <th class="text-left py-2 px-3 text-muted font-medium">Joined</th>
            <th class="text-left py-2 px-3 text-muted font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in (data as unknown as Record<string, unknown>).items as Record<string, unknown>[]"
            :key="user.id as string"
            class="border-b border-subtle hover:bg-surface-subtle"
          >
            <td class="py-2 px-3 text-primary">{{ user.name as string ?? "—" }}</td>
            <td class="py-2 px-3 text-primary">{{ user.email as string }}</td>
            <td class="py-2 px-3 text-primary capitalize">{{ user.role as string }}</td>
            <td class="py-2 px-3 text-primary">{{ user.tier as number ?? "—" }}</td>
            <td class="py-2 px-3 text-muted">{{ formatDate(user.createdAt as string) }}</td>
            <td class="py-2 px-3">
              <button
                class="text-sm text-primary hover:underline"
                @click="router.push(`/admin/users/${user.id as string}`)"
              >
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="flex items-center justify-between mt-4">
        <span class="text-sm text-muted">
          Total: {{ (data as unknown as Record<string, unknown>).total as number }} users
        </span>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 text-sm rounded border border-default text-primary disabled:opacity-50"
            :disabled="page <= 1"
            @click="page--"
          >
            Previous
          </button>
          <span class="px-3 py-1 text-sm text-muted">
            Page {{ page }} of {{ (data as unknown as Record<string, unknown>).totalPages as number }}
          </span>
          <button
            class="px-3 py-1 text-sm rounded border border-default text-primary disabled:opacity-50"
            :disabled="page >= ((data as unknown as Record<string, unknown>).totalPages as number)"
            @click="page++"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
