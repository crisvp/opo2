import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { AppUser, UserUsage, UserTierInfo } from "@opo/shared";
import { apiClient } from "../client";

export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
  usage: () => [...profileKeys.all, "usage"] as const,
  tier: () => [...profileKeys.all, "tier"] as const,
  apiKeys: () => [...profileKeys.all, "api-keys"] as const,
  location: () => [...profileKeys.all, "location"] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => apiClient.get<AppUser>("/profile"),
  });
}

export function useProfileUsage() {
  return useQuery({
    queryKey: profileKeys.usage(),
    queryFn: () => apiClient.get<UserUsage>("/profile/usage"),
  });
}

export function useProfileTier() {
  return useQuery({
    queryKey: profileKeys.tier(),
    queryFn: () => apiClient.get<UserTierInfo>("/profile/tier"),
  });
}

export function useProfileApiKeys() {
  return useQuery({
    queryKey: profileKeys.apiKeys(),
    queryFn: () => apiClient.get<{ hasKey: boolean; maskedKey: string | null; dailyLimit: number | null }>("/profile/api-keys"),
  });
}

export function useProfileLocation() {
  return useQuery({
    queryKey: profileKeys.location(),
    queryFn: () => apiClient.get<{ stateUsps: string | null; placeGeoid: string | null }>("/profile/location"),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.put<AppUser>("/profile", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useUpdateProfileLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stateUsps?: string | null; placeGeoid?: string | null }) =>
      apiClient.put<{ stateUsps: string | null; placeGeoid: string | null }>("/profile/location", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.location() });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useSetApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.post<unknown>("/profile/api-keys", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.apiKeys() });
    },
  });
}

export function useSetOpenRouterKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiClient.put<void>("/profile/api-keys/openrouter", { key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.apiKeys() });
    },
  });
}

export function useDeleteOpenRouterKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<void>("/profile/api-keys/openrouter"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.apiKeys() });
    },
  });
}

export function useUpdateApiKeySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dailyLimit: number) =>
      apiClient.put<void>("/profile/api-keys/openrouter/settings", { dailyLimit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.apiKeys() });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/profile/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.apiKeys() });
    },
  });
}
