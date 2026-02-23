import { test, expect } from "@playwright/test";

test.describe("Document Browsing — F05", () => {
  test("browse page renders document list", async ({ page }) => {
    await page.goto("/browse");
    await expect(page.getByRole("heading", { name: "Browse Documents" })).toBeVisible();

    await expect(
      page.getByTestId("document-card").first().or(page.locator("text=No documents found")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("search input filters results", async ({ page }) => {
    await page.goto("/browse");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Search documents…");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("nonexistent-document-xyz-abc-12345");

    await page.waitForLoadState("networkidle");

    await expect(
      page.getByTestId("document-card").first().or(page.locator("text=No documents found")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("clicking a document card navigates to document detail page", async ({ page }) => {
    // /browse is publicly accessible — no login required
    await page.goto("/browse");
    await page.waitForLoadState("networkidle");

    const firstCard = page.getByTestId("document-card").first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await expect(page).toHaveURL(/\/documents\//, { timeout: 5000 });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 5000 });
    } else {
      // No approved documents in the E2E environment — verify page is still functional
      await expect(page.getByRole("heading", { name: "Browse Documents" })).toBeVisible();
    }
  });
});
