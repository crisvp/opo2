import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import FileDropzone from "../../src/components/documents/FileDropzone.vue";

function makeFile(name = "test.pdf", size = 1024, type = "application/pdf"): File {
  const file = new File(["x".repeat(size)], name, { type });
  return file;
}

function mountDropzone(props: { accept?: string; maxSize?: number } = {}) {
  return mount(FileDropzone, { props });
}

describe("FileDropzone", () => {
  it("renders the dropzone area", () => {
    const wrapper = mountDropzone();
    const dropzone = wrapper.find("[data-testid='dropzone']");
    expect(dropzone.exists()).toBe(true);
  });

  it("shows placeholder text when no file selected", () => {
    const wrapper = mountDropzone();
    expect(wrapper.text()).toContain("Drop a file here");
  });

  it("shows file name after selection", async () => {
    const wrapper = mountDropzone();
    const file = makeFile("document.pdf");

    // Simulate drop event
    await wrapper.trigger("drop", {
      dataTransfer: {
        files: [file],
      },
    });

    expect(wrapper.text()).toContain("document.pdf");
  });

  it("shows file size after selection", async () => {
    const wrapper = mountDropzone();
    const file = makeFile("document.pdf", 2 * 1024 * 1024);

    await wrapper.trigger("drop", {
      dataTransfer: {
        files: [file],
      },
    });

    expect(wrapper.text()).toContain("MB");
  });

  it("emits select event when file is dropped", async () => {
    const wrapper = mountDropzone();
    const file = makeFile("test.pdf");

    await wrapper.trigger("drop", {
      dataTransfer: {
        files: [file],
      },
    });

    const emitted = wrapper.emitted("select");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBe(file);
  });

  it("emits error when file exceeds maxSize", async () => {
    const wrapper = mountDropzone({ maxSize: 1024 });
    const largeFile = makeFile("big.pdf", 2048);

    await wrapper.trigger("drop", {
      dataTransfer: {
        files: [largeFile],
      },
    });

    const errorEmitted = wrapper.emitted("error");
    expect(errorEmitted).toBeTruthy();
    const errorMessage = errorEmitted![0][0] as string;
    expect(errorMessage).toContain("too large");
  });

  it("does not emit select when file exceeds maxSize", async () => {
    const wrapper = mountDropzone({ maxSize: 1024 });
    const largeFile = makeFile("big.pdf", 2048);

    await wrapper.trigger("drop", {
      dataTransfer: {
        files: [largeFile],
      },
    });

    expect(wrapper.emitted("select")).toBeFalsy();
  });

  it("applies dragOver class on dragover event", async () => {
    const wrapper = mountDropzone();
    const dropzone = wrapper.find("[data-testid='dropzone']");

    await dropzone.trigger("dragover");

    expect(dropzone.classes()).toContain("border-primary");
  });

  it("removes dragOver class on dragleave", async () => {
    const wrapper = mountDropzone();
    const dropzone = wrapper.find("[data-testid='dropzone']");

    await dropzone.trigger("dragover");
    await dropzone.trigger("dragleave");

    expect(dropzone.classes()).not.toContain("border-primary");
  });

  it("includes file input element", () => {
    const wrapper = mountDropzone();
    const input = wrapper.find("[data-testid='file-input']");
    expect(input.exists()).toBe(true);
    expect(input.attributes("type")).toBe("file");
  });

  it("sets accept attribute on file input when provided", () => {
    const wrapper = mountDropzone({ accept: "application/pdf" });
    const input = wrapper.find("[data-testid='file-input']");
    expect(input.attributes("accept")).toBe("application/pdf");
  });

  it("shows max size hint when maxSize is provided", () => {
    const wrapper = mountDropzone({ maxSize: 50 * 1024 * 1024 });
    expect(wrapper.text()).toContain("Max size: 50MB");
  });

  it("emits select when file input changes", async () => {
    const wrapper = mountDropzone();
    const file = makeFile("uploaded.pdf");
    const input = wrapper.find("[data-testid='file-input']");

    // Simulate file input change
    Object.defineProperty(input.element, "files", {
      value: [file],
      writable: false,
    });
    await input.trigger("change");

    const emitted = wrapper.emitted("select");
    expect(emitted).toBeTruthy();
  });
});
