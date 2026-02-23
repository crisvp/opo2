<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { authClient } from "../services/authClient.js";
import { useAuthStore } from "../stores/auth.js";
import type { AppUser } from "@opo/shared";

const router = useRouter();
const authStore = useAuthStore();

const code = ref("");
const errorMessage = ref("");
const loading = ref(false);

async function handleVerify() {
  errorMessage.value = "";
  if (!code.value || code.value.length !== 6) {
    errorMessage.value = "Please enter the 6-digit code from your authenticator app.";
    return;
  }
  loading.value = true;
  try {
    const result = await authClient.twoFactor.verifyTotp({ code: code.value });

    if (result.error) {
      errorMessage.value = result.error.message ?? "Verification failed.";
      return;
    }

    if (result.data?.user) {
      authStore.setUser(result.data.user as unknown as AppUser);
    }

    await router.push("/");
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : "Verification failed.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-sunken">
    <div class="w-full max-w-sm p-8 bg-elevated rounded-lg border border-default">
      <h1 class="text-2xl font-semibold text-primary mb-2">Two-Factor Authentication</h1>
      <p class="text-secondary mb-6">
        Enter the 6-digit code from your authenticator app to continue.
      </p>

      <form @submit.prevent="handleVerify" novalidate class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="code" class="text-sm font-medium text-primary">Verification Code</label>
          <InputText
            id="code"
            v-model="code"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            placeholder="000000"
            autocomplete="one-time-code"
            class="w-full text-center tracking-widest text-lg"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-critical" role="alert">
          {{ errorMessage }}
        </p>

        <Button
          type="submit"
          label="Verify"
          :loading="loading"
          class="w-full"
        />
      </form>
    </div>
  </div>
</template>
