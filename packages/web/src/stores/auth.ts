import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authClient } from "../services/authClient";
import { hasRole } from "@opo/shared";
import type { AppUser } from "@opo/shared";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AppUser | null>(null);
  const initialized = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  function hasRole_(role: string): boolean {
    if (!user.value) return false;
    return hasRole(user.value.role as "user" | "moderator" | "admin", role as "user" | "moderator" | "admin");
  }

  async function init() {
    if (initialized.value) return;
    try {
      const session = await authClient.getSession();
      user.value = (session?.data?.user as unknown as AppUser) ?? null;
    } catch {
      user.value = null;
    } finally {
      initialized.value = true;
    }
  }

  async function signOut() {
    await authClient.signOut();
    user.value = null;
  }

  function setUser(u: AppUser | null) {
    user.value = u;
  }

  return {
    user,
    initialized,
    isAuthenticated,
    hasRole: hasRole_,
    init,
    signOut,
    setUser,
  };
});
