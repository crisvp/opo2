import { test, expect } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

test.describe("Document Upload — F02", () => {
  test("full upload flow submits document into pipeline", async ({ page }) => {
    const email = `e2e-upload-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "uploadpass123", name: "E2E Uploader" });

    // Handle CORS preflight requests from Chromium to RustFS (localhost:9000).
    // The presigned-POST flow is cross-origin (5173 → 9000). We fulfill OPTIONS
    // responses so the browser allows the real POST to proceed. If RustFS already
    // has a CORS policy (set in global-setup), these intercepts are never reached.
    await page.route("http://localhost:9000/**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Methods": "GET,POST,PUT,HEAD,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3000",
          },
          body: "",
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload Document" })).toBeVisible();

    // Step 1: attach a minimal valid PDF via the hidden file input
    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj 2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj 3 0 obj<</Type /Page /MediaBox [0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF",
      "ascii",
    );

    await page.getByTestId("file-input").setInputFiles({
      name: "test-document.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    await expect(page.locator("text=test-document.pdf")).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: metadata
    await page.locator('input[placeholder="Document title"]').fill("E2E Test Upload Document");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: location — leave empty and proceed
    await page.getByRole("button", { name: "Next" }).click();

    // Step 4: review — confirm title is shown and submit
    await expect(page.locator("text=E2E Test Upload Document")).toBeVisible();
    await page.getByRole("button", { name: "Submit" }).click();

    // After successful upload + S3 PUT + confirm-upload, router redirects to the document page
    await expect(page).toHaveURL(/\/(documents\/[^/]+|my-uploads)/, { timeout: 20000 });
  });

  test("upload page requires authentication", async ({ page }) => {
    await page.request.post("http://localhost:3000/api/auth/sign-out");
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("rejects files over 50 MB", async ({ page }) => {
    const email = `e2e-upload-size-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "uploadpass123", name: "E2E Uploader Size" });

    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload Document" })).toBeVisible();

    // 51 MB buffer — exceeds the 50 MB limit enforced in the dropzone
    const oversizeBuffer = Buffer.alloc(51 * 1024 * 1024, 0);

    await page.getByTestId("file-input").setInputFiles({
      name: "too-large.pdf",
      mimeType: "application/pdf",
      buffer: oversizeBuffer,
    });

    // File should be rejected — Next button stays disabled or an error is shown
    const nextBtn = page.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeDisabled({ timeout: 3000 });
  });

  test("rejects disallowed MIME types", async ({ page }) => {
    const email = `e2e-upload-mime-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "uploadpass123", name: "E2E Uploader MIME" });

    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload Document" })).toBeVisible();

    await page.getByTestId("file-input").setInputFiles({
      name: "script.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ"),
    });

    // File should be rejected — Next button stays disabled or an error is shown
    const nextBtn = page.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeDisabled({ timeout: 3000 });
  });
});
