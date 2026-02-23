<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { authClient } from "../services/authClient.js";

const email = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);

async function handleSubmit() {
  errorMessage.value = "";
  successMessage.value = "";
  loading.value = true;
  try {
    const result = await authClient.requestPasswordReset({
      email: email.value,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (result.error) {
      errorMessage.value = result.error.message ?? "Failed to send reset email.";
      return;
    }

    successMessage.value = "If an account with that email exists, a password reset link has been sent.";
    email.value = "";
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : "Failed to send reset email.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-sunken">
    <div class="w-full max-w-md p-8 bg-elevated rounded-lg border border-default">
      <h1 class="text-2xl font-semibold text-primary mb-2">Forgot Password</h1>
      <p class="text-secondary mb-6">Enter your email address and we'll send you a reset link.</p>

      <form @submit.prevent="handleSubmit" novalidate class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="email" class="text-sm font-medium text-primary">Email</label>
          <InputText
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            class="w-full"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-critical" role="alert">
          {{ errorMessage }}
        </p>

        <p v-if="successMessage" class="text-sm text-success" role="status">
          {{ successMessage }}
        </p>

        <Button
          type="submit"
          label="Send Reset Link"
          :loading="loading"
          class="w-full"
        />
      </form>

      <p class="mt-6 text-center text-sm text-secondary">
        Remember your password?
        <router-link to="/login" class="text-link font-medium">Sign In</router-link>
      </p>
    </div>
  </div>
</template>
