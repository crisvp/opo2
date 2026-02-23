<script setup lang="ts">
import { ref, computed } from "vue";
import type { GovernmentLevel } from "@opo/shared";
import { useAuthStore } from "../stores/auth";
import { useProfileUsage, useProfileLocation, useUpdateProfileLocation, useProfileApiKeys, useSetOpenRouterKey, useDeleteOpenRouterKey, useUpdateApiKeySettings } from "../api/queries/profile";
import LocationSelector from "../components/locations/LocationSelector.vue";

const authStore = useAuthStore();
const user = computed(() => authStore.user);

const { data: usage, isLoading: usageLoading } = useProfileUsage();
const { data: locationData, isLoading: locationLoading } = useProfileLocation();
const { mutate: updateLocation, isPending: locationSaving } = useUpdateProfileLocation();
const { data: apiKeyData, isLoading: apiKeyLoading } = useProfileApiKeys();
const { mutate: setOpenRouterKey, isPending: keySettingPending } = useSetOpenRouterKey();
const { mutate: deleteOpenRouterKey, isPending: keyDeletingPending } = useDeleteOpenRouterKey();
const { mutate: updateApiKeySettings, isPending: settingsPending } = useUpdateApiKeySettings();

// Location form state
const locationLevel = ref<GovernmentLevel | null>(null);
const locationStateUsps = ref<string | null>(null);
const locationPlaceGeoid = ref<string | null>(null);
const locationTribeId = ref<string | null>(null);

// Sync from loaded location
const locationInitialized = ref(false);
function initLocation() {
  if (locationData.value && !locationInitialized.value) {
    locationStateUsps.value = locationData.value.stateUsps ?? null;
    locationPlaceGeoid.value = locationData.value.placeGeoid ?? null;
    if (locationStateUsps.value && locationPlaceGeoid.value) {
      locationLevel.value = "place";
    } else if (locationStateUsps.value) {
      locationLevel.value = "state";
    }
    locationInitialized.value = true;
  }
}

// API key form
const newApiKey = ref("");
const dailyLimitInput = ref<number>(10);

function saveLocation() {
  updateLocation({
    stateUsps: locationStateUsps.value,
    placeGeoid: locationPlaceGeoid.value,
  });
}

function saveApiKey() {
  if (!newApiKey.value) return;
  setOpenRouterKey(newApiKey.value, {
    onSuccess: () => {
      newApiKey.value = "";
    },
  });
}

function removeApiKey() {
  deleteOpenRouterKey();
}

function saveDailyLimit() {
  updateApiKeySettings(dailyLimitInput.value);
}
</script>

<template>
  <div class="p-8 max-w-3xl mx-auto space-y-8">
    <h1 class="text-2xl font-semibold text-primary">Profile</h1>

    <!-- User Info Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-3">
      <h2 class="text-lg font-medium text-primary">Account Information</h2>
      <div v-if="user" class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <span class="text-muted">Name</span>
        <span class="text-primary">{{ user.name ?? "—" }}</span>
        <span class="text-muted">Email</span>
        <span class="text-primary">{{ user.email }}</span>
        <span class="text-muted">Role</span>
        <span class="text-primary capitalize">{{ user.role }}</span>
        <span class="text-muted">Tier</span>
        <span class="text-primary">{{ user.tier }}</span>
      </div>
      <p v-else class="text-muted text-sm">Loading...</p>
    </section>

    <!-- Location Preference Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium text-primary">Location Preference</h2>
      <p class="text-muted text-sm">Set your default location for browsing documents.</p>
      <div v-if="!locationLoading" @vue:mounted="initLocation()">
        <LocationSelector
          :government-level="locationLevel"
          :state-usps="locationStateUsps"
          :place-geoid="locationPlaceGeoid"
          :tribe-id="locationTribeId"
          @update:government-level="locationLevel = $event"
          @update:state-usps="locationStateUsps = $event"
          @update:place-geoid="locationPlaceGeoid = $event"
          @update:tribe-id="locationTribeId = $event"
        />
        <button
          class="mt-4 px-4 py-2 rounded bg-surface border border-default text-primary text-sm hover:bg-surface-subtle disabled:opacity-50"
          :disabled="locationSaving"
          @click="saveLocation"
        >
          {{ locationSaving ? "Saving..." : "Save Location" }}
        </button>
      </div>
      <p v-else class="text-muted text-sm">Loading...</p>
    </section>

    <!-- Usage Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium text-primary">Usage</h2>
      <div v-if="!usageLoading && usage">
        <div
          v-for="item in (Array.isArray(usage) ? usage : [])"
          :key="(item as Record<string, unknown>).limitType as string"
          class="flex justify-between items-center text-sm py-2 border-b border-subtle last:border-0"
        >
          <span class="text-muted capitalize">{{ (item as Record<string, unknown>).limitType as string }}</span>
          <span class="text-primary">
            {{ (item as Record<string, unknown>).used as number }} /
            {{ (item as Record<string, unknown>).limit as number }}
          </span>
        </div>
        <p v-if="!(Array.isArray(usage) ? usage : []).length" class="text-muted text-sm">No usage data available.</p>
      </div>
      <p v-else-if="usageLoading" class="text-muted text-sm">Loading...</p>
      <p v-else class="text-muted text-sm">No usage data available.</p>
    </section>

    <!-- API Keys Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium text-primary">API Keys</h2>
      <div v-if="!apiKeyLoading && apiKeyData">
        <div v-if="(apiKeyData as Record<string, unknown>).hasKey" class="space-y-3">
          <div class="text-sm">
            <span class="text-muted">Current key: </span>
            <span class="text-primary font-mono">{{ (apiKeyData as Record<string, unknown>).maskedKey as string }}</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted">Daily limit:</label>
            <input
              v-model.number="dailyLimitInput"
              type="number"
              min="1"
              max="100"
              class="w-20 px-2 py-1 text-sm rounded border border-default bg-surface text-primary"
            />
            <button
              class="px-3 py-1 rounded border border-default text-primary text-sm hover:bg-surface-subtle disabled:opacity-50"
              :disabled="settingsPending"
              @click="saveDailyLimit"
            >
              {{ settingsPending ? "Saving..." : "Save Limit" }}
            </button>
          </div>
          <button
            class="px-3 py-1 rounded border border-default text-primary text-sm hover:bg-surface-subtle disabled:opacity-50"
            :disabled="keyDeletingPending"
            @click="removeApiKey"
          >
            {{ keyDeletingPending ? "Removing..." : "Remove Key" }}
          </button>
        </div>
        <div v-else class="space-y-3">
          <p class="text-muted text-sm">No OpenRouter API key configured.</p>
          <div class="flex gap-3">
            <input
              v-model="newApiKey"
              type="password"
              placeholder="sk-or-v1-..."
              class="flex-1 px-3 py-2 text-sm rounded border border-default bg-surface text-primary"
            />
            <button
              class="px-4 py-2 rounded bg-surface border border-default text-primary text-sm hover:bg-surface-subtle disabled:opacity-50"
              :disabled="keySettingPending || !newApiKey"
              @click="saveApiKey"
            >
              {{ keySettingPending ? "Saving..." : "Save Key" }}
            </button>
          </div>
        </div>
      </div>
      <p v-else-if="apiKeyLoading" class="text-muted text-sm">Loading...</p>
    </section>
  </div>
</template>
