import { useQuery, useMutation } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { State, Place, Tribe, NearestPlacesRequest } from "@opo/shared";
import { apiClient } from "../client";

export const locationKeys = {
  all: ["locations"] as const,
  states: () => [...locationKeys.all, "states"] as const,
  state: (usps: string) => [...locationKeys.states(), usps] as const,
  places: (stateUsps?: string) => [...locationKeys.all, "places", stateUsps ?? "all"] as const,
  counties: (stateUsps?: string) => [...locationKeys.all, "counties", stateUsps ?? "all"] as const,
  place: (geoid: string) => [...locationKeys.all, "place", geoid] as const,
  tribes: () => [...locationKeys.all, "tribes"] as const,
  tribe: (tribeId: string) => [...locationKeys.all, "tribe", tribeId] as const,
  overview: (params: Record<string, unknown>) => [...locationKeys.all, "overview", params] as const,
};

export function useStateList() {
  return useQuery({
    queryKey: locationKeys.states(),
    queryFn: () => apiClient.get<State[]>("/locations/states"),
  });
}

export function useStateDetail(usps: Ref<string>) {
  return useQuery({
    queryKey: computed(() => locationKeys.state(usps.value)),
    queryFn: () => apiClient.get<State>(`/locations/states/${usps.value}`),
    enabled: computed(() => !!usps.value),
  });
}

export function usePlaceList(stateUsps: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => locationKeys.places(stateUsps.value ?? undefined)),
    queryFn: () => apiClient.get<Place[]>(`/locations/states/${stateUsps.value}/places`),
    enabled: computed(() => !!stateUsps.value),
  });
}

export function useCountyList(stateUsps: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => locationKeys.counties(stateUsps.value ?? undefined)),
    queryFn: () => apiClient.get<Place[]>(`/locations/states/${stateUsps.value}/counties`),
    enabled: computed(() => !!stateUsps.value),
  });
}

export function usePlaceDetail(geoid: Ref<string>) {
  return useQuery({
    queryKey: computed(() => locationKeys.place(geoid.value)),
    queryFn: () => apiClient.get<Place>(`/locations/places/${geoid.value}`),
    enabled: computed(() => !!geoid.value),
  });
}

export function useTribeList() {
  return useQuery({
    queryKey: locationKeys.tribes(),
    queryFn: () => apiClient.get<Tribe[]>("/locations/tribes"),
  });
}

export function useTribeDetail(tribeId: Ref<string>) {
  return useQuery({
    queryKey: computed(() => locationKeys.tribe(tribeId.value)),
    queryFn: () => apiClient.get<Tribe>(`/locations/tribes/${tribeId.value}`),
    enabled: computed(() => !!tribeId.value),
  });
}

export function useNearestPlacesMutation() {
  return useMutation({
    mutationFn: (body: NearestPlacesRequest) =>
      apiClient.post<Place[]>("/locations/nearest", body),
  });
}

export interface LocationOverviewData {
  documentCount: number;
  documentsByCategory: Record<string, number>;
  policies: { typeId: string; typeName: string; exists: boolean; documentId: string | null }[];
  vendors: { id: string; name: string; documentCount: number }[];
  technologies: { id: string; name: string; documentCount: number }[];
  agencies: { id: string; name: string; category: string | null; documentCount: number }[];
  stateMetadata: { key: string; value: string; url: string | null }[];
}

export function useLocationOverview(
  level: Ref<string>,
  state?: Ref<string | null>,
  place?: Ref<string | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      locationKeys.overview({
        level: level.value,
        state: state?.value ?? null,
        place: place?.value ?? null,
      }),
    ),
    queryFn: () => {
      const l = level.value;
      const s = state?.value;
      const p = place?.value;
      let url = `/locations/overview/${l}`;
      if (s) url += `/${s}`;
      if (p) url += `/${p}`;
      return apiClient.get<LocationOverviewData>(url);
    },
    enabled: computed(() => !!level.value),
  });
}
