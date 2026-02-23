<script setup lang="ts">
import { useAdminStats } from "../../api/queries/admin";
import { useRouter } from "vue-router";

const { data: stats, isLoading } = useAdminStats();
const router = useRouter();
</script>

<template>
  <div class="p-8 space-y-8">
    <h1 class="text-2xl font-semibold text-primary">Admin Dashboard</h1>

    <div v-if="isLoading" class="text-muted">Loading stats...</div>

    <div v-else-if="stats" class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- User Count -->
      <div class="bg-elevated rounded-lg p-6">
        <p class="text-muted text-sm">Total Users</p>
        <p class="text-3xl font-bold text-primary mt-1">
          {{ (stats as Record<string, unknown>).userCount as number }}
        </p>
      </div>

      <!-- Total Documents -->
      <div class="bg-elevated rounded-lg p-6">
        <p class="text-muted text-sm">Total Documents</p>
        <p class="text-3xl font-bold text-primary mt-1">
          {{ (stats as Record<string, unknown>).totalDocuments as number }}
        </p>
      </div>

      <!-- Quick Links -->
      <div class="bg-elevated rounded-lg p-6 space-y-2">
        <p class="text-muted text-sm font-medium">Quick Links</p>
        <div class="flex flex-col gap-1">
          <button
            class="text-left text-sm text-primary hover:underline"
            @click="router.push('/admin/users')"
          >
            Manage Users
          </button>
          <button
            class="text-left text-sm text-primary hover:underline"
            @click="router.push('/admin/failed-processing')"
          >
            Failed Processing
          </button>
          <button
            class="text-left text-sm text-primary hover:underline"
            @click="router.push('/admin/jobs')"
          >
            Job Queue
          </button>
        </div>
      </div>
    </div>

    <!-- Document Counts by State -->
    <section v-if="stats" class="bg-elevated rounded-lg p-6">
      <h2 class="text-lg font-medium text-primary mb-4">Documents by Status</h2>
      <div class="space-y-2">
        <div
          v-for="(count, state) in (stats as Record<string, unknown>).documentCounts as Record<string, number>"
          :key="state"
          class="flex justify-between items-center text-sm py-1 border-b border-subtle last:border-0"
        >
          <span class="text-muted capitalize">{{ state.replace(/_/g, " ") }}</span>
          <span class="text-primary font-medium">{{ count }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
