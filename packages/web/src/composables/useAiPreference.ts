import { ref, watch } from "vue";
import { useProfile, useUpdateProfile } from "../api/queries/profile";

export function useAiPreference() {
  const { data: profile } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();

  // Session override — undefined means "use profile value"
  const sessionOverride = ref<boolean | undefined>(undefined);
  const enabled = ref(true); // default until profile loads

  // Sync from profile on first load (only if no session override)
  watch(
    () => profile.value?.aiSuggestions?.enabled,
    (val) => {
      if (val !== undefined && sessionOverride.value === undefined) {
        enabled.value = val;
      }
    },
    { immediate: true },
  );

  function setEnabled(val: boolean) {
    sessionOverride.value = val;
    enabled.value = val;
  }

  function persistToProfile() {
    updateProfile({ aiSuggestionsEnabled: enabled.value });
  }

  return { enabled, setEnabled, persistToProfile };
}
