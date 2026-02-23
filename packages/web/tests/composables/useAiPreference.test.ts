import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";

// Mock TanStack Query
vi.mock("@tanstack/vue-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock the profile queries module
vi.mock("../../src/api/queries/profile", () => ({
  useProfile: vi.fn(),
  useUpdateProfile: vi.fn(),
}));

import { useAiPreference } from "../../src/composables/useAiPreference";
import { useProfile, useUpdateProfile } from "../../src/api/queries/profile";

const mockUseProfile = vi.mocked(useProfile);
const mockUseUpdateProfile = vi.mocked(useUpdateProfile);

function buildProfileData(enabled: boolean) {
  return ref({
    aiSuggestions: {
      enabled,
      available: true,
      usingOwnKey: false,
      limits: { monthly: null, used: 0 },
    },
  });
}

describe("useAiPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateProfile.mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useUpdateProfile>);
  });

  it("syncs enabled from profile.aiSuggestions.enabled on load", async () => {
    mockUseProfile.mockReturnValue({
      data: buildProfileData(false),
    } as unknown as ReturnType<typeof useProfile>);

    let composable!: ReturnType<typeof useAiPreference>;

    const TestComponent = defineComponent({
      setup() {
        composable = useAiPreference();
        return {};
      },
      template: "<div></div>",
    });

    mount(TestComponent);
    await nextTick();

    expect(composable.enabled.value).toBe(false);
  });

  it("session override sticks after setEnabled is called", async () => {
    // Profile says enabled: true
    const profileData = buildProfileData(true);
    mockUseProfile.mockReturnValue({
      data: profileData,
    } as unknown as ReturnType<typeof useProfile>);

    let composable!: ReturnType<typeof useAiPreference>;

    const TestComponent = defineComponent({
      setup() {
        composable = useAiPreference();
        return {};
      },
      template: "<div></div>",
    });

    mount(TestComponent);
    await nextTick();

    // Session override: disable
    composable.setEnabled(false);
    await nextTick();

    // Simulate profile re-fetching and still returning enabled: true
    // The watch fires again but sessionOverride is set, so it should NOT overwrite
    profileData.value = {
      aiSuggestions: {
        enabled: true,
        available: true,
        usingOwnKey: false,
        limits: { monthly: null, used: 0 },
      },
    };
    await nextTick();

    // Session override wins — enabled stays false
    expect(composable.enabled.value).toBe(false);
  });

  it("persistToProfile calls updateProfile with aiSuggestionsEnabled", async () => {
    const mockMutate = vi.fn();
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
    } as unknown as ReturnType<typeof useUpdateProfile>);

    mockUseProfile.mockReturnValue({
      data: buildProfileData(true),
    } as unknown as ReturnType<typeof useProfile>);

    let composable!: ReturnType<typeof useAiPreference>;

    const TestComponent = defineComponent({
      setup() {
        composable = useAiPreference();
        return {};
      },
      template: "<div></div>",
    });

    mount(TestComponent);
    await nextTick();

    composable.setEnabled(false);
    composable.persistToProfile();

    expect(mockMutate).toHaveBeenCalledWith({ aiSuggestionsEnabled: false });
  });
});
