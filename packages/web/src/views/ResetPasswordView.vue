<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import Button from "primevue/button";
import Password from "primevue/password";
import { authClient } from "../services/authClient.js";

const router = useRouter();
const route = useRoute();

const newPassword = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);

async function handleSubmit() {
  errorMessage.value = "";
  successMessage.value = "";

  const token = route.query.token as string | undefined;
  if (!token) {
    errorMessage.value = "Invalid or missing reset token. Please request a new reset link.";
    return;
  }

  loading.value = true;
  try {
    const result = await authClient.resetPassword({
      newPassword: newPassword.value,
      token,
    });

    if (result.error) {
      errorMessage.value = result.error.message ?? "Failed to reset password.";
      return;
    }

    successMessage.value = "Password reset successfully. Redirecting to sign in…";
    setTimeout(() => {
      void router.push({ name: "login" });
    }, 2000);
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : "Failed to reset password.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-sunken">
    <div class="w-full max-w-md p-8 bg-elevated rounded-lg border border-default">
      <h1 class="text-2xl font-semibold text-primary mb-2">Reset Password</h1>
      <p class="text-secondary mb-6">Enter your new password below.</p>

      <form @submit.prevent="handleSubmit" novalidate class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="new-password" class="text-sm font-medium text-primary">New Password</label>
          <Password
            id="new-password"
            v-model="newPassword"
            :feedback="true"
            :toggleMask="true"
            placeholder="Choose a strong password"
            autocomplete="new-password"
            input-class="w-full"
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
          label="Reset Password"
          :loading="loading"
          class="w-full"
        />
      </form>

      <p class="mt-6 text-center text-sm text-secondary">
        <router-link to="/login" class="text-link font-medium">Back to Sign In</router-link>
      </p>
    </div>
  </div>
</template>
