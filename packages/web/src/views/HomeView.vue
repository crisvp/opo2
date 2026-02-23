<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const isAuthenticated = computed(() => !!authStore.user);
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-16 text-center">
    <!-- Unauthenticated -->
    <template v-if="!isAuthenticated">
      <h1 class="text-4xl font-bold text-primary mb-4">Open Panopticon</h1>
      <p class="text-lg text-secondary mb-8">
        A crowdsourced repository of public records related to surveillance.
        Upload, categorize, and explore government documents.
      </p>
      <div class="flex justify-center gap-4">
        <RouterLink
          to="/register"
          class="px-6 py-3 bg-interactive text-inverted rounded-lg font-medium hover:opacity-90"
          data-testid="register-cta"
        >
          Get Started
        </RouterLink>
        <RouterLink
          to="/login"
          class="px-6 py-3 border border-default rounded-lg font-medium text-primary hover:bg-sunken"
          data-testid="login-cta"
        >
          Sign In
        </RouterLink>
      </div>
    </template>

    <!-- Authenticated -->
    <template v-else>
      <h1 class="text-3xl font-bold text-primary mb-4">Welcome back</h1>
      <p class="text-secondary mb-8">
        Continue contributing to the public records repository.
      </p>
      <div class="flex justify-center gap-4">
        <RouterLink
          to="/upload"
          class="px-6 py-3 bg-interactive text-inverted rounded-lg font-medium hover:opacity-90"
          data-testid="upload-cta"
        >
          Upload Document
        </RouterLink>
        <RouterLink
          to="/browse"
          class="px-6 py-3 border border-default rounded-lg font-medium text-primary hover:bg-sunken"
          data-testid="browse-cta"
        >
          Browse Documents
        </RouterLink>
      </div>
    </template>
  </div>
</template>
