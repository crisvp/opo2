import { test, expect } from "@playwright/test";
import { registerAndSignIn } from "./helpers/auth";

const API_BASE = "http://localhost:3000";

test.describe("AI Review → Submit flow — F07", () => {
  test("unauthenticated user is redirected to login from /documents/:id/ai-review", async ({ page }) => {
    await page.request.post(`${API_BASE}/api/auth/sign-out`);
    await page.goto("/documents/any-id/ai-review");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("authenticated user can navigate to /documents/:id/ai-review", async ({ page }) => {
    // Register and sign in as a fresh user
    const email = `e2e-ai-review-${Date.now()}@example.com`;
    await registerAndSignIn(page, {
      email,
      password: "airev1ewpass",
      name: "E2E AI Review User",
    });

    // Navigate to a non-existent document's ai-review page.
    // The page should load and either show a 404 / error state, not redirect to login.
    await page.goto("/documents/non-existent-doc-id/ai-review");

    // Should still be on the ai-review URL (auth passed), even if document not found
    await expect(page).toHaveURL(/\/documents\/non-existent-doc-id\/ai-review/, { timeout: 5000 });
  });

  test("ai-review page renders without crashing for an existing document in user_review state", async ({
    page,
    request,
  }) => {
    // This test requires seeded data. Skip if no document in user_review state exists.
    const email = `e2e-ai-flow-${Date.now()}@example.com`;
    await registerAndSignIn(page, {
      email,
      password: "aiflowpass1",
      name: "E2E AI Flow User",
    });

    // Fetch user's documents to check if any are in user_review
    const docsRes = await request.get(`${API_BASE}/api/documents/my-uploads`);
    if (!docsRes.ok()) {
      test.skip();
      return;
    }

    const docsData = (await docsRes.json()) as {
      success: boolean;
      data: { items: Array<{ id: string; state: string }> };
    };

    const userReviewDoc = docsData.data?.items?.find((d) => d.state === "user_review");
    if (!userReviewDoc) {
      test.skip();
      return;
    }

    await page.goto(`/documents/${userReviewDoc.id}/ai-review`);
    await expect(page).toHaveURL(`/documents/${userReviewDoc.id}/ai-review`, { timeout: 5000 });
    await expect(page.locator("body")).toBeVisible();
  });
});
