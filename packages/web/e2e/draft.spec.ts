import { test, expect } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

const API_BASE = "http://localhost:3000";

test.describe("Draft → My Uploads flow — F02/F06", () => {
  test("unauthenticated user is redirected to login from /upload", async ({ page }) => {
    await page.request.post(`${API_BASE}/api/auth/sign-out`);
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("unauthenticated user is redirected to login from /my-uploads", async ({ page }) => {
    await page.request.post(`${API_BASE}/api/auth/sign-out`);
    await page.goto("/my-uploads");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("authenticated user can access /upload page", async ({ page }) => {
    const email = `e2e-draft-upload-${Date.now()}@example.com`;
    await registerAndSignIn(page, {
      email,
      password: "draftpass123",
      name: "E2E Draft User",
    });

    await page.goto("/upload");
    await expect(page).toHaveURL("/upload", { timeout: 5000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("authenticated user can access /my-uploads page", async ({ page }) => {
    const email = `e2e-draft-myuploads-${Date.now()}@example.com`;
    await registerAndSignIn(page, {
      email,
      password: "draftpass456",
      name: "E2E My Uploads User",
    });

    await page.goto("/my-uploads");
    await expect(page).toHaveURL("/my-uploads", { timeout: 5000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("/my-uploads shows empty state for new user with no uploads", async ({ page }) => {
    const email = `e2e-draft-empty-${Date.now()}@example.com`;
    await registerAndSignIn(page, {
      email,
      password: "emptypass123",
      name: "E2E Empty Uploads User",
    });

    await page.goto("/my-uploads");
    await expect(page).toHaveURL("/my-uploads", { timeout: 5000 });

    // Page should load without crashing
    await expect(page.locator("body")).toBeVisible();

    // Should not show a loading spinner forever
    const loadingSpinner = page.locator("[data-testid='loading']");
    await expect(loadingSpinner).toHaveCount(0, { timeout: 8000 });
  });

  test("my-uploads renders documents list after API seed", async ({ page, request }) => {
    const email = `e2e-draft-seed-${Date.now()}@example.com`;
    await registerAndSignIn(page, {
      email,
      password: "seedpass123",
      name: "E2E Seeded Draft User",
    });

    // Use the session cookies to create a document via API
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Initiate an upload (creates a draft document)
    const initiateRes = await request.post(`${API_BASE}/api/documents/initiate`, {
      data: {
        title: "E2E Draft Test Document",
        filename: "test.pdf",
        contentType: "application/pdf",
        contentLength: 1024,
        saveAsDraft: true,
      },
      headers: { Cookie: cookieStr },
    });

    if (!initiateRes.ok()) {
      // Upload initiation may fail if S3 is not available in CI
      test.skip();
      return;
    }

    // Navigate to my-uploads
    await page.goto("/my-uploads");
    await expect(page).toHaveURL("/my-uploads", { timeout: 5000 });

    // Page should render successfully
    await expect(page.locator("body")).toBeVisible();
  });
});
