<script setup lang="ts">
import { ref, computed } from "vue";
import AutoComplete from "primevue/autocomplete";
import type { AutoCompleteCompleteEvent } from "primevue/autocomplete";
import type { State, Place, Tribe } from "@opo/shared";
import { useStateList, useTribeList } from "../../api/queries/locations";
import { apiClient } from "../../api/client";

export interface LocationSelection {
  governmentLevel: "state" | "place" | "tribal";
  stateUsps?: string;
  placeGeoid?: string;
  tribeId?: string;
  label: string;
}

interface SuggestionItem {
  id: string;
  label: string;
  sublabel: string;
  location: LocationSelection;
}

const props = defineProps<{
  modelValue: LocationSelection | null;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: LocationSelection | null];
}>();

const { data: states } = useStateList();
const { data: tribes } = useTribeList();

const suggestions = ref<SuggestionItem[]>([]);
const isLoading = ref(false);
const selected = ref<SuggestionItem | null>(null);

// Detect a 2-letter state abbreviation at the end of the query string
// e.g. "dubuque, ia" or "dubuque ia" -> "IA"
function extractStateCode(query: string): string | null {
  const match = /[,\s]+([a-zA-Z]{2})\s*$/.exec(query.trim());
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}

function buildStateItems(query: string): SuggestionItem[] {
  const q = query.toLowerCase();
  return (states.value ?? [])
    .filter((s: State) => s.name.toLowerCase().includes(q) || s.usps.toLowerCase().includes(q))
    .map((s: State): SuggestionItem => ({
      id: `state:${s.usps}`,
      label: `${s.name} (State)`,
      sublabel: s.usps,
      location: {
        governmentLevel: "state",
        stateUsps: s.usps,
        label: `${s.name} (State)`,
      },
    }));
}

function buildTribeItems(query: string, tribeData: Tribe[]): SuggestionItem[] {
  const q = query.toLowerCase();
  return tribeData
    .filter((t: Tribe) => t.name.toLowerCase().includes(q))
    .map((t: Tribe): SuggestionItem => ({
      id: `tribe:${t.id}`,
      label: `${t.name} (Tribal)`,
      sublabel: t.isAlaskaNative ? "Alaska Native" : "Tribal Nation",
      location: {
        governmentLevel: "tribal",
        tribeId: t.id,
        label: `${t.name} (Tribal)`,
      },
    }));
}

function buildPlaceLabel(place: Place): string {
  if (place.lsad) {
    return `${place.lsad} of ${place.name}, ${place.usps}`;
  }
  return `${place.name}, ${place.usps}`;
}

function buildPlaceItems(places: Place[]): SuggestionItem[] {
  return places.map((p: Place): SuggestionItem => ({
    id: `place:${p.geoid}`,
    label: buildPlaceLabel(p),
    sublabel: `${p.usps} · GEOID ${p.geoid}`,
    location: {
      governmentLevel: "place",
      stateUsps: p.usps,
      placeGeoid: p.geoid,
      label: buildPlaceLabel(p),
    },
  }));
}

async function fetchPlaceSuggestions(query: string, stateCode: string): Promise<SuggestionItem[]> {
  // Fetch both incorporated places and counties in parallel for the matched state
  const baseQuery = query.replace(/[,\s]+[a-zA-Z]{2}\s*$/, "").trim().toLowerCase();
  try {
    const [places, counties] = await Promise.all([
      apiClient.get<Place[]>(`/locations/states/${stateCode}/places`),
      apiClient.get<Place[]>(`/locations/states/${stateCode}/counties`),
    ]);
    const allPlaces = [...places, ...counties];
    const filtered = baseQuery.length > 0
      ? allPlaces.filter((p: Place) => p.name.toLowerCase().includes(baseQuery))
      : allPlaces;
    return buildPlaceItems(filtered.slice(0, 20));
  } catch {
    return [];
  }
}

async function handleComplete(event: AutoCompleteCompleteEvent) {
  const query = event.query.trim();
  if (query.length < 2) {
    suggestions.value = [];
    return;
  }

  isLoading.value = true;
  try {
    const stateItems = buildStateItems(query);

    // Tribe search: use server-side search for efficiency if tribes not loaded, else filter
    const tribeData: Tribe[] = tribes.value ?? [];
    const tribeItems = buildTribeItems(query, tribeData);

    // Place search: only when a state code is detectable in the query
    let placeItems: SuggestionItem[] = [];
    const detectedState = extractStateCode(query);
    if (detectedState) {
      placeItems = await fetchPlaceSuggestions(query, detectedState);
    }

    // Combine: places first (most specific), then states, then tribes
    suggestions.value = [...placeItems, ...stateItems, ...tribeItems].slice(0, 40);
  } finally {
    isLoading.value = false;
  }
}

function handleSelect(event: { value: SuggestionItem }) {
  selected.value = event.value;
  emit("update:modelValue", event.value.location);
}

function handleClear() {
  selected.value = null;
  emit("update:modelValue", null);
}

// Sync external modelValue changes to local selected state
const displayValue = computed(() => {
  if (props.modelValue) {
    return { label: props.modelValue.label } as SuggestionItem;
  }
  return null;
});
</script>

<template>
  <AutoComplete
    :model-value="selected ?? displayValue"
    :suggestions="suggestions"
    option-label="label"
    :placeholder="placeholder ?? 'Search states, places, or tribes…'"
    :disabled="disabled"
    :loading="isLoading"
    :min-length="2"
    force-selection
    class="w-full"
    @complete="handleComplete"
    @option-select="handleSelect"
    @clear="handleClear"
  >
    <template #option="{ option }: { option: SuggestionItem }">
      <div class="flex flex-col gap-0.5">
        <span class="font-medium">{{ option.label }}</span>
        <span class="text-muted text-xs">{{ option.sublabel }}</span>
      </div>
    </template>
  </AutoComplete>
</template>
