<script setup lang="ts">
import Select from "primevue/select";
import { useStateList } from "../../api/queries/locations";
import type { GovernmentLevel } from "@opo/shared";
import PlaceAutocomplete from "./PlaceAutocomplete.vue";
import CountyAutocomplete from "./CountyAutocomplete.vue";
import TribeAutocomplete from "./TribeAutocomplete.vue";

const props = defineProps<{
  governmentLevel: GovernmentLevel | null;
  stateUsps: string | null;
  placeGeoid: string | null;
  tribeId: string | null;
}>();

const emit = defineEmits<{
  "update:governmentLevel": [v: GovernmentLevel | null];
  "update:stateUsps": [v: string | null];
  "update:placeGeoid": [v: string | null];
  "update:tribeId": [v: string | null];
}>();

const { data: states } = useStateList();

const levelOptions = [
  { label: "Federal", value: "federal" },
  { label: "State", value: "state" },
  { label: "County", value: "county" },
  { label: "Local (Place)", value: "place" },
  { label: "Tribal", value: "tribal" },
];

function onLevelChange(val: GovernmentLevel | null) {
  emit("update:governmentLevel", val);
  emit("update:stateUsps", null);
  emit("update:placeGeoid", null);
  emit("update:tribeId", null);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Select
      :model-value="governmentLevel"
      :options="levelOptions"
      option-label="label"
      option-value="value"
      placeholder="Select government level"
      show-clear
      @update:model-value="onLevelChange"
    />
    <Select
      v-if="governmentLevel === 'state' || governmentLevel === 'county' || governmentLevel === 'place'"
      :model-value="stateUsps"
      :options="states ?? []"
      option-label="name"
      option-value="usps"
      placeholder="Select state"
      show-clear
      @update:model-value="(v) => emit('update:stateUsps', v)"
    />
    <CountyAutocomplete
      v-if="governmentLevel === 'county' && stateUsps"
      :state-usps="stateUsps"
      placeholder="Search counties…"
      @select="(c) => emit('update:placeGeoid', c.geoid)"
      @clear="() => emit('update:placeGeoid', null)"
    />
    <PlaceAutocomplete
      v-if="governmentLevel === 'place' && stateUsps"
      :state-usps="stateUsps"
      placeholder="Search places…"
      @select="(p) => emit('update:placeGeoid', p.geoid)"
      @clear="() => emit('update:placeGeoid', null)"
    />
    <TribeAutocomplete
      v-if="governmentLevel === 'tribal'"
      placeholder="Search tribes…"
      @select="(t) => emit('update:tribeId', t.id)"
      @clear="() => emit('update:tribeId', null)"
    />
  </div>
</template>
