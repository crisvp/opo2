<script setup lang="ts">
import { ref, computed } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import Button from "primevue/button";
import Password from "primevue/password";
import { authClient } from "../services/authClient.js";
import { useAuthStore } from "../stores/auth.js";

const authStore = useAuthStore();
const queryClient = useQueryClient();

// ── Passkeys ─────────────────────────────────────────────────────────────────
// useListPasskeys() is the Vue reactive hook generated from the listPasskeys atom
// (see better-auth/vue — atoms become use${Capitalize<key>}() hooks)
const passkeyAtom = authClient.useListPasskeys();

const passkeys = computed(() => passkeyAtom.value.data ?? []);
const passkeysLoading = computed(() => passkeyAtom.value.isPending);
const passkeysError = computed(() => passkeyAtom.value.error);

const addingPasskey = ref(false);
const passkeyError = ref("");

async function handleAddPasskey() {
  passkeyError.value = "";
  addingPasskey.value = true;
  try {
    const result = await authClient.passkey.addPasskey();
    if (result?.error) {
      passkeyError.value = result.error.message ?? "Failed to add passkey.";
      return;
    }
    await passkeyAtom.value.refetch();
  } catch (err: unknown) {
    passkeyError.value = err instanceof Error ? err.message : "Failed to add passkey.";
  } finally {
    addingPasskey.value = false;
  }
}

async function handleDeletePasskey(id: string) {
  passkeyError.value = "";
  try {
    const result = await authClient.passkey.deletePasskey({ id });
    if (result?.error) {
      passkeyError.value = result.error.message ?? "Failed to delete passkey.";
      return;
    }
    await passkeyAtom.value.refetch();
  } catch (err: unknown) {
    passkeyError.value = err instanceof Error ? err.message : "Failed to delete passkey.";
  }
}

// ── Two-Factor Auth ───────────────────────────────────────────────────────────

const twoFactorEnabled = computed(
  () =>
    !!(
      authStore.user as (typeof authStore.user & { twoFactorEnabled?: boolean }) | null
    )?.twoFactorEnabled
);

// Enable 2FA flow
const showEnable2FA = ref(false);
const enablePassword = ref("");
const enableError = ref("");
const enabling2FA = ref(false);
const totpUri = ref("");
const backupCodes = ref<string[]>([]);

async function handleEnable2FA() {
  enableError.value = "";
  if (!enablePassword.value) {
    enableError.value = "Password is required to enable 2FA.";
    return;
  }
  enabling2FA.value = true;
  try {
    const result = await authClient.twoFactor.enable({ password: enablePassword.value });
    if (result.error) {
      enableError.value = result.error.message ?? "Failed to enable 2FA.";
      return;
    }
    totpUri.value = result.data?.totpURI ?? "";
    backupCodes.value = result.data?.backupCodes ?? [];
    // Refresh auth store so twoFactorEnabled reflects new state
    await authStore.init();
    showEnable2FA.value = false;
    enablePassword.value = "";
  } catch (err: unknown) {
    enableError.value = err instanceof Error ? err.message : "Failed to enable 2FA.";
  } finally {
    enabling2FA.value = false;
  }
}

// Disable 2FA flow
const showDisable2FA = ref(false);
const disablePassword = ref("");
const disableError = ref("");
const disabling2FA = ref(false);

async function handleDisable2FA() {
  disableError.value = "";
  if (!disablePassword.value) {
    disableError.value = "Password is required to disable 2FA.";
    return;
  }
  disabling2FA.value = true;
  try {
    const result = await authClient.twoFactor.disable({ password: disablePassword.value });
    if (result.error) {
      disableError.value = result.error.message ?? "Failed to disable 2FA.";
      return;
    }
    await authStore.init();
    showDisable2FA.value = false;
    disablePassword.value = "";
    totpUri.value = "";
    backupCodes.value = [];
  } catch (err: unknown) {
    disableError.value = err instanceof Error ? err.message : "Failed to disable 2FA.";
  } finally {
    disabling2FA.value = false;
  }
}

// Unused but kept to satisfy import requirement for TanStack Query (used in sibling views)
void queryClient;
</script>

<template>
  <div class="max-w-2xl mx-auto p-8 flex flex-col gap-10">
    <h1 class="text-2xl font-semibold text-primary">Security Settings</h1>

    <!-- ── Passkeys Section ─────────────────────────────────────── -->
    <section class="bg-elevated border border-default rounded-lg p-6 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-primary">Passkeys</h2>
          <p class="text-sm text-secondary mt-0.5">
            Sign in without a password using biometrics or a hardware key.
          </p>
        </div>
        <Button
          label="Add Passkey"
          icon="pi pi-plus"
          :loading="addingPasskey"
          @click="handleAddPasskey"
        />
      </div>

      <p v-if="passkeyError" class="text-sm text-critical" role="alert">
        {{ passkeyError }}
      </p>

      <div v-if="passkeysLoading" class="text-sm text-muted">Loading passkeys…</div>

      <p v-else-if="passkeysError" class="text-sm text-critical">
        Failed to load passkeys.
      </p>

      <ul v-else-if="passkeys.length > 0" class="flex flex-col gap-2">
        <li
          v-for="pk in passkeys"
          :key="pk.id"
          class="flex items-center justify-between p-3 bg-sunken border border-subtle rounded"
        >
          <div>
            <p class="text-sm font-medium text-primary">
              {{ pk.name || pk.credentialID || pk.id }}
            </p>
            <p v-if="pk.createdAt" class="text-xs text-muted">
              Added {{ new Date(pk.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            aria-label="Delete passkey"
            @click="handleDeletePasskey(pk.id)"
          />
        </li>
      </ul>

      <p v-else class="text-sm text-muted">No passkeys registered yet.</p>
    </section>

    <!-- ── Two-Factor Auth Section ──────────────────────────────── -->
    <section class="bg-elevated border border-default rounded-lg p-6 flex flex-col gap-4">
      <div>
        <h2 class="text-lg font-semibold text-primary">Two-Factor Authentication</h2>
        <p class="text-sm text-secondary mt-0.5">
          Add an extra layer of security using a TOTP authenticator app.
        </p>
      </div>

      <!-- TOTP URI display after enabling -->
      <div
        v-if="totpUri"
        class="bg-sunken border border-subtle rounded p-4 flex flex-col gap-2"
      >
        <p class="text-sm font-medium text-primary">2FA Enabled Successfully</p>
        <p class="text-xs text-secondary">
          Scan this URI with your authenticator app or copy it manually:
        </p>
        <code class="text-xs text-muted break-all bg-sunken rounded p-2">
          {{ totpUri }}
        </code>
        <div v-if="backupCodes.length > 0">
          <p class="text-xs font-medium text-primary mt-2">Backup Codes (save these now):</p>
          <ul class="mt-1 flex flex-wrap gap-2">
            <li
              v-for="code in backupCodes"
              :key="code"
              class="font-mono text-xs bg-sunken rounded px-2 py-1 text-primary border border-subtle"
            >
              {{ code }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Enable 2FA -->
      <div v-if="!twoFactorEnabled && !totpUri">
        <Button
          v-if="!showEnable2FA"
          label="Enable 2FA"
          @click="showEnable2FA = true"
        />

        <form v-else @submit.prevent="handleEnable2FA" class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <label for="enable-password" class="text-sm font-medium text-primary">
              Confirm Password
            </label>
            <Password
              id="enable-password"
              v-model="enablePassword"
              :feedback="false"
              :toggleMask="false"
              placeholder="Your current password"
              autocomplete="current-password"
              input-class="w-full"
              class="w-full"
            />
          </div>
          <p v-if="enableError" class="text-sm text-critical" role="alert">
            {{ enableError }}
          </p>
          <div class="flex gap-2">
            <Button type="submit" label="Confirm Enable" :loading="enabling2FA" />
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              @click="showEnable2FA = false; enablePassword = ''; enableError = ''"
            />
          </div>
        </form>
      </div>

      <!-- Disable 2FA -->
      <div v-if="twoFactorEnabled">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-sm font-medium text-success">2FA is enabled</span>
        </div>

        <Button
          v-if="!showDisable2FA"
          label="Disable 2FA"
          severity="danger"
          @click="showDisable2FA = true"
        />

        <form v-else @submit.prevent="handleDisable2FA" class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <label for="disable-password" class="text-sm font-medium text-primary">
              Confirm Password
            </label>
            <Password
              id="disable-password"
              v-model="disablePassword"
              :feedback="false"
              :toggleMask="false"
              placeholder="Your current password"
              autocomplete="current-password"
              input-class="w-full"
              class="w-full"
            />
          </div>
          <p v-if="disableError" class="text-sm text-critical" role="alert">
            {{ disableError }}
          </p>
          <div class="flex gap-2">
            <Button
              type="submit"
              label="Confirm Disable"
              severity="danger"
              :loading="disabling2FA"
            />
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              @click="showDisable2FA = false; disablePassword = ''; disableError = ''"
            />
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
