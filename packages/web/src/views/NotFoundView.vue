<script setup lang="ts">
import { useRouter } from "vue-router";
import Button from "primevue/button";

const router = useRouter();
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-sunken">
    <div class="text-center p-8">
      <h1 class="text-8xl font-bold text-muted mb-4">404</h1>
      <h2 class="text-2xl font-semibold text-primary mb-2">Page Not Found</h2>
      <p class="text-secondary mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Button
        label="Go Home"
        @click="router.push('/')"
      />
    </div>
  </div>
</template>
