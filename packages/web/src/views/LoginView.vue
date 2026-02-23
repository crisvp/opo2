<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import { authClient } from "../services/authClient.js";
import { useAuthStore } from "../stores/auth.js";
import type { AppUser } from "@opo/shared";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref("");
const password = ref("");
const errorMessage = ref("");
const loading = ref(false);

async function handleSignIn() {
  errorMessage.value = "";
  loading.value = true;
  try {
    const result = await authClient.signIn.email({
      email: email.value,
      password: password.value,
    });

    if (result.error) {
      const code = result.error.code ?? "";
      if (
        code === "TWO_FACTOR_REQUIRED" ||
        code === "OTP_REQUIRED" ||
        code === "TOTP_REQUIRED"
      ) {
        await router.push({ name: "two-factor" });
        return;
      }
      errorMessage.value = result.error.message ?? "Sign in failed.";
      return;
    }

    if (result.data?.user) {
      authStore.setUser(result.data.user as unknown as AppUser);
    }

    const redirect = (route.query.redirect as string) || "/";
    await router.push(redirect);
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : "Sign in failed.";
  } finally {
    loading.value = false;
  }
}

async function handlePasskeySignIn() {
  errorMessage.value = "";
  loading.value = true;
  try {
    const result = await authClient.signIn.passkey();

    if (result?.error) {
      errorMessage.value = result.error.message ?? "Passkey sign-in failed.";
      return;
    }

    if (result?.data?.user) {
      authStore.setUser(result.data.user as unknown as AppUser);
    }

    const redirect = (route.query.redirect as string) || "/";
    await router.push(redirect);
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : "Passkey sign-in failed.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-sunken">
    <div class="w-full max-w-md p-8 bg-elevated rounded-lg border border-default">
      <h1 class="text-2xl font-semibold text-primary mb-2">Sign In</h1>
      <p class="text-secondary mb-6">Welcome back to Open Panopticon.</p>

      <form @submit.prevent="handleSignIn" novalidate class="flex flex-col gap-4">
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

        <div class="flex flex-col gap-1">
          <label for="password" class="text-sm font-medium text-primary">Password</label>
          <Password
            id="password"
            v-model="password"
            :feedback="false"
            :toggleMask="false"
            placeholder="Your password"
            autocomplete="current-password"
            input-class="w-full"
            class="w-full"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-critical" role="alert">
          {{ errorMessage }}
        </p>

        <Button
          type="submit"
          label="Sign In"
          :loading="loading"
          class="w-full"
        />
      </form>

      <div class="mt-4">
        <Button
          type="button"
          label="Sign in with Passkey"
          severity="secondary"
          :loading="loading"
          class="w-full"
          @click="handlePasskeySignIn"
        />
      </div>

      <p class="mt-6 text-center text-sm text-secondary">
        Don't have an account?
        <router-link to="/register" class="text-link font-medium">Register</router-link>
      </p>
    </div>
  </div>
</template>
