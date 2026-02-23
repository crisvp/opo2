import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TagInput from "../../src/components/shared/TagInput.vue";

function mountTagInput(modelValue: string[] = []) {
  return mount(TagInput, {
    props: { modelValue },
  });
}

describe("TagInput", () => {
  it("renders existing tags as chips", () => {
    const wrapper = mountTagInput(["vue", "typescript"]);
    const chips = wrapper.findAll("[data-testid='tag-chip']");
    expect(chips).toHaveLength(2);
    expect(chips[0].text()).toContain("vue");
    expect(chips[1].text()).toContain("typescript");
  });

  it("renders text input for adding new tags", () => {
    const wrapper = mountTagInput();
    const input = wrapper.find("[data-testid='tag-text-input']");
    expect(input.exists()).toBe(true);
  });

  it("adds tag on Enter key", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("newtag");
    await input.trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual(["newtag"]);
  });

  it("adds tag on comma key", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("newtag");
    await input.trigger("keydown", { key: "," });

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual(["newtag"]);
  });

  it("does not add duplicate tags", async () => {
    const wrapper = mountTagInput(["existing"]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("existing");
    await input.trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("update:modelValue");
    // No emit since tag is duplicate
    expect(emitted).toBeFalsy();
  });

  it("removes tag when remove button clicked", async () => {
    const wrapper = mountTagInput(["vue", "typescript"]);
    const removeButtons = wrapper.findAll("[data-testid='remove-tag']");

    await removeButtons[0].trigger("click");

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    const newTags = emitted![0][0] as string[];
    expect(newTags).not.toContain("vue");
    expect(newTags).toContain("typescript");
  });

  it("lowercases tag before adding", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("UPPERCASE");
    await input.trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual(["uppercase"]);
  });

  it("trims whitespace before adding", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("  trimmed  ");
    await input.trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual(["trimmed"]);
  });

  it("clears input after adding tag", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("newtag");
    await input.trigger("keydown", { key: "Enter" });

    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("does not add empty tag on Enter", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("   ");
    await input.trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeFalsy();
  });

  it("adds tag on blur", async () => {
    const wrapper = mountTagInput([]);
    const input = wrapper.find("[data-testid='tag-text-input']");

    await input.setValue("blurtag");
    await input.trigger("blur");

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual(["blurtag"]);
  });

  it("renders remove button for each tag", () => {
    const wrapper = mountTagInput(["tag1", "tag2", "tag3"]);
    const removeButtons = wrapper.findAll("[data-testid='remove-tag']");
    expect(removeButtons).toHaveLength(3);
  });

  it("renders with empty array without crashing", () => {
    const wrapper = mountTagInput([]);
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.findAll("[data-testid='tag-chip']")).toHaveLength(0);
  });
});
