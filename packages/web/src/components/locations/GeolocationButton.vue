<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";

const emit = defineEmits<{
  located: [coords: { lat: number; lon: number }];
  error: [message: string];
}>();

const loading = ref(false);

function locate() {
  if (!navigator.geolocation) {
    emit("error", "Geolocation not supported");
    return;
  }
  loading.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      loading.value = false;
      emit("located", { lat: pos.coords.latitude, lon: pos.coords.longitude });
    },
    (err) => {
      loading.value = false;
      emit("error", err.message);
    },
  );
}
</script>

<template>
  <Button
    icon="pi pi-map-marker"
    :loading="loading"
    label="Use my location"
    severity="secondary"
    @click="locate"
  />
</template>
