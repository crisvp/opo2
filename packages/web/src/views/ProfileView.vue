<script setup lang="ts">
import { ref } from "vue";
import type { GovernmentLevel } from "@opo/shared";
import { useAuthStore } from "../stores/auth";
import {
  useProfile,
  useUpdateProfile,
  useUpdateProfileLocation,
  useProfileApiKeys,
  useSetOpenRouterKey,
  useDeleteOpenRouterKey,
  useUpdateApiKeySettings,
} from "../api/queries/profile";
import LocationSelector from "../components/locations/LocationSelector.vue";
import ToggleSwitch from "primevue/toggleswitch";

const authStore = useAuthStore();

const { data: profile, isLoading: profileLoading } = useProfile();
const { mutate: updateProfile } = useUpdateProfile();
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

// Sync from loaded profile location
const locationInitialized = ref(false);
function initLocation() {
  if (profile.value && !locationInitialized.value) {
    locationStateUsps.value = profile.value.location.stateUsps ?? null;
    locationPlaceGeoid.value = profile.value.location.placeGeoid ?? null;
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
      <div v-if="!profileLoading && profile" class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <span class="text-muted">Name</span>
        <span class="text-primary">{{ profile.name ?? "—" }}</span>
        <span class="text-muted">Email</span>
        <span class="text-primary">{{ profile.email }}</span>
        <span class="text-muted">Role</span>
        <span class="text-primary capitalize">{{ profile.role }}</span>
        <span class="text-muted">Tier</span>
        <span class="text-primary">{{ profile.tierName }}</span>
      </div>
      <p v-else class="text-muted text-sm">Loading...</p>
    </section>

    <!-- AI Analysis Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium text-primary">AI Analysis</h2>
      <p class="text-muted text-sm">When enabled, documents you upload will be analyzed by AI to suggest metadata.</p>
      <div v-if="!profileLoading && profile">
        <div class="flex items-center gap-3">
          <ToggleSwitch
            :model-value="profile.aiSuggestions.enabled"
            @update:model-value="updateProfile({ aiSuggestionsEnabled: $event })"
          />
          <span class="text-sm text-primary">{{ profile.aiSuggestions.enabled ? "Enabled" : "Disabled" }}</span>
        </div>
        <p v-if="!profile.aiSuggestions.available" class="mt-2 text-sm text-surface-500">
          AI analysis is currently unavailable (no API key configured or limit reached).
        </p>
      </div>
      <p v-else class="text-muted text-sm">Loading...</p>
    </section>

    <!-- Location Preference Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium text-primary">Location Preference</h2>
      <p class="text-muted text-sm">Set your default location for browsing documents.</p>
      <div v-if="!profileLoading && profile" @vue:mounted="initLocation()">
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
      <div v-if="!profileLoading && profile">
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm py-2 border-b border-subtle">
            <span class="text-muted">AI Suggestions (monthly)</span>
            <span class="text-primary">
              {{ profile.aiSuggestions.limits.used }}
              <template v-if="profile.aiSuggestions.limits.monthly !== null">
                / {{ profile.aiSuggestions.limits.monthly }}
              </template>
              <template v-else> (unlimited)</template>
            </span>
          </div>
        </div>
      </div>
      <p v-else class="text-muted text-sm">Loading...</p>
    </section>

    <!-- API Keys Section -->
    <section class="bg-elevated rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium text-primary">API Keys</h2>
      <div v-if="!apiKeyLoading && apiKeyData">
        <div v-if="apiKeyData.hasKey" class="space-y-3">
          <div class="text-sm">
            <span class="text-muted">Current key: </span>
            <span class="text-primary font-mono">{{ apiKeyData.maskedKey }}</span>
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
