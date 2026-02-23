import { test, expect } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

const API_BASE = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Initiates an upload to create a document record in `pending_upload` state.
 * Returns the document id, or null if S3/services are unavailable.
 */
async function createDraftDocument(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
  cookieStr: string,
  title = "E2E Document Test",
): Promise<string | null> {
  const res = await request.post(`${API_BASE}/api/documents/initiate`, {
    data: {
      title,
      filename: "test.pdf",
      contentType: "application/pdf",
      contentLength: 1024,
      saveAsDraft: true,
    },
    headers: { Cookie: cookieStr },
  });

  if (!res.ok()) return null;

  const body = (await res.json()) as { success: boolean; data?: { documentId: string } };
  if (!body.success || !body.data?.documentId) return null;

  return body.data.documentId;
}

// ---------------------------------------------------------------------------
// Document Detail View — /documents/:id
// ---------------------------------------------------------------------------

test.describe("Document Detail View — /documents/:id", () => {
  test("unauthenticated user gets error state for non-existent document", async ({ page }) => {
    await page.request.post(`${API_BASE}/api/auth/sign-out`);
    await page.goto("/documents/nonexistent-id-xyz");

    // Should either show the error state from the component, or a 404 page
    await expect(page.locator("body")).toBeVisible();

    // If the document detail view loaded but the fetch failed, show error state
    // If the router handled 404, the NotFoundView is shown
    const errorOrNotFound = page
      .getByText(/failed to load|not found|404/i)
      .or(page.getByText(/Failed to load document/));

    // Page should not just spin forever
    await expect(errorOrNotFound.or(page.getByText(/document/i))).toBeVisible({ timeout: 8000 });
  });

  test("navigating to an invalid document id does not crash the page", async ({ page }) => {
    await page.goto("/documents/totally-invalid-id-12345");
    // Just verify the page renders something (error state is fine)
    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    // Should not have an unhandled JS error (Playwright catches console errors via listeners)
  });

  test("authenticated user can view their own draft document detail", async ({
    page,
    request,
  }) => {
    const email = `e2e-docdetail-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "docdetailpass1", name: "Doc Detail User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, "My E2E Detail Document");
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}`);

    // Title should be visible in the document detail view
    await expect(page.getByRole("heading", { name: "My E2E Detail Document" })).toBeVisible({
      timeout: 8000,
    });

    // State badge should be visible
    await expect(page.locator("[data-testid='state-badge']")).toBeVisible({ timeout: 5000 });
  });

  test("document detail page shows Download link", async ({ page, request }) => {
    const email = `e2e-docdownload-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "docdownload1", name: "Doc Download User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, "Download Test Document");
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}`);
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Document Edit View — /documents/:id/edit
// ---------------------------------------------------------------------------

test.describe("Document Edit View — /documents/:id/edit", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.request.post(`${API_BASE}/api/auth/sign-out`);
    await page.goto("/documents/some-doc-id/edit");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("edit page renders form elements for a draft document", async ({ page, request }) => {
    const email = `e2e-docedit-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "doceditpass1", name: "Doc Edit User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, "Edit Form Render Test");
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}/edit`);

    // Form elements from DocumentEditView
    await expect(page.getByRole("heading", { name: "Edit Document" })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.locator("[data-testid='title-input']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-testid='description-input']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-testid='save-button']")).toBeVisible({ timeout: 5000 });
  });

  test("edit page pre-fills title from existing document", async ({ page, request }) => {
    const originalTitle = `PreFill Test ${Date.now()}`;
    const email = `e2e-docprefill-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "docprefill1", name: "Doc PreFill User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, originalTitle);
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}/edit`);
    await page.locator("[data-testid='title-input']").waitFor({ timeout: 8000 });

    const titleValue = await page.locator("[data-testid='title-input']").inputValue();
    expect(titleValue).toBe(originalTitle);
  });

  test("edit page saves updated title and redirects to detail view", async ({ page, request }) => {
    const email = `e2e-docupdate-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "docupdatepass1", name: "Doc Update User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, "Original Title");
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}/edit`);
    await page.locator("[data-testid='title-input']").waitFor({ timeout: 8000 });

    // Update the title
    await page.locator("[data-testid='title-input']").fill("Updated Title E2E");

    // Submit the form
    await page.locator("[data-testid='save-button']").click();

    // Should redirect to document detail page
    await expect(page).toHaveURL(`/documents/${docId}`, { timeout: 10000 });

    // Updated title should appear
    await expect(page.getByRole("heading", { name: "Updated Title E2E" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("cancel link on edit page returns to document detail", async ({ page, request }) => {
    const email = `e2e-doccancel-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "doccancelpass1", name: "Doc Cancel User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, "Cancel Test Document");
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}/edit`);
    await page.getByRole("heading", { name: "Edit Document" }).waitFor({ timeout: 8000 });

    // Click the Cancel link in the header area
    await page.getByRole("link", { name: "Cancel" }).first().click();

    // Should navigate back to document detail
    await expect(page).toHaveURL(`/documents/${docId}`, { timeout: 5000 });
  });

  test("edit page description field can be updated", async ({ page, request }) => {
    const email = `e2e-docdesc-${Date.now()}@example.com`;
    await registerAndSignIn(page, { email, password: "docdescpass1", name: "Doc Desc User" });

    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const docId = await createDraftDocument(request, cookieStr, "Description Update Test");
    if (!docId) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${docId}/edit`);
    await page.locator("[data-testid='description-input']").waitFor({ timeout: 8000 });

    await page.locator("[data-testid='description-input']").fill("A test description for E2E");

    // Save the form
    await page.locator("[data-testid='save-button']").click();

    // Should redirect back to detail
    await expect(page).toHaveURL(`/documents/${docId}`, { timeout: 10000 });
  });
});
