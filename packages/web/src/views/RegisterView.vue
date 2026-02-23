<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import { authClient } from "../services/authClient.js";
import { useAuthStore } from "../stores/auth.js";
import type { AppUser } from "@opo/shared";

const router = useRouter();
const authStore = useAuthStore();

const name = ref("");
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const loading = ref(false);

// ALTCHA state
const altchaPayload = ref<string | null>(null);
const altchaChallengeJson = ref<string | null>(null);

onMounted(async () => {
  try {
    const res = await fetch("/api/altcha/challenge");
    if (res.ok) {
      const data = await res.text();
      altchaChallengeJson.value = data;
    }
  } catch {
    // Challenge fetch failure is non-fatal; server will reject on submit if missing
  }
});

function onAltchaStateChange(ev: Event) {
  const detail = (ev as CustomEvent<{ state: string; payload: string }>).detail;
  if (detail?.state === "verified") {
    altchaPayload.value = detail.payload;
  }
}

async function handleRegister() {
  errorMessage.value = "";
  loading.value = true;
  try {
    const result = await authClient.signUp.email({
      name: name.value,
      email: email.value,
      password: password.value,
      // altchaPayload is passed as an additional field so the server-side
      // databaseHooks.user.create.before hook can verify the PoW solution.
      altchaPayload: altchaPayload.value ?? "",
    } as Parameters<typeof authClient.signUp.email>[0]);

    if (result.error) {
      errorMessage.value = result.error.message ?? "Registration failed.";
      return;
    }

    if (result.data?.user) {
      authStore.setUser(result.data.user as unknown as AppUser);
    }

    await router.push("/");
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : "Registration failed.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-sunken">
    <div class="w-full max-w-md p-8 bg-elevated rounded-lg border border-default">
      <h1 class="text-2xl font-semibold text-primary mb-2">Create Account</h1>
      <p class="text-secondary mb-6">Join Open Panopticon.</p>

      <form @submit.prevent="handleRegister" novalidate class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="name" class="text-sm font-medium text-primary">Name</label>
          <InputText
            id="name"
            v-model="name"
            type="text"
            placeholder="Your full name"
            autocomplete="name"
            class="w-full"
          />
        </div>

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
            :feedback="true"
            :toggleMask="false"
            placeholder="Choose a strong password"
            autocomplete="new-password"
            input-class="w-full"
            class="w-full"
          />
        </div>

        <!-- ALTCHA proof-of-work widget (native web component from altcha-wc) -->
        <div v-if="altchaChallengeJson">
          <altcha-widget
            :challengejson="altchaChallengeJson"
            hidefooter
            @statechange="onAltchaStateChange"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-critical" role="alert">
          {{ errorMessage }}
        </p>

        <Button
          type="submit"
          label="Create Account"
          :loading="loading"
          class="w-full"
        />
      </form>

      <p class="mt-6 text-center text-sm text-secondary">
        Already have an account?
        <router-link to="/login" class="text-link font-medium">Sign in</router-link>
      </p>
    </div>
  </div>
</template>
