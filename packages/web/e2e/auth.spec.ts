import { test, expect } from "@playwright/test";
import { solveChallenge } from "altcha-lib";

const TEST_EMAIL = `e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = "e2epassword123";
const TEST_NAME = "E2E Test User";

/**
 * Fetches a fresh ALTCHA challenge from the API, solves it, and returns the
 * base64-encoded payload string ready to inject into the registration form.
 */
async function solveAltchaChallenge(baseURL: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/altcha/challenge`);
  if (!res.ok) throw new Error(`Failed to fetch ALTCHA challenge: ${res.status}`);
  const challenge = (await res.json()) as {
    algorithm: string;
    challenge: string;
    salt: string;
    signature: string;
    maxnumber?: number;
  };

  const { promise } = solveChallenge(
    challenge.challenge,
    challenge.salt,
    challenge.algorithm,
    challenge.maxnumber ?? 100_000,
  );
  const solution = await promise;
  if (!solution) throw new Error("Failed to solve ALTCHA challenge");

  return btoa(
    JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      number: solution.number,
      salt: challenge.salt,
      signature: challenge.signature,
    }),
  );
}

test.describe("Authentication — F01", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    // PrimeVue Password wraps the input — locate via placeholder
    await expect(page.getByPlaceholder("Your password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("register page links to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("login page links to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Register" }).click();
    await expect(page).toHaveURL("/register");
  });

  test("full registration → sign-in → sign-out flow", async ({ page }) => {
    // Solve ALTCHA challenge before loading the form
    const payload = await solveAltchaChallenge("http://localhost:3000");

    // Step 1: Register
    await page.goto("/register");
    await page.getByLabel("Name").fill(TEST_NAME);
    await page.getByLabel("Email").fill(TEST_EMAIL);
    // PrimeVue Password component — fill inner input then press Escape to close the overlay
    await page.getByPlaceholder("Choose a strong password").fill(TEST_PASSWORD);
    await page.keyboard.press("Escape");

    // Wait for ALTCHA widget to render (challenge fetch in onMounted is async)
    await page.locator("altcha-widget").waitFor({ timeout: 10000 });

    // Inject the solved altcha payload into the Vue component via the custom element event
    await page.evaluate((solvedPayload) => {
      const widget = document.querySelector("altcha-widget");
      if (widget) {
        widget.dispatchEvent(
          new CustomEvent("statechange", {
            detail: { state: "verified", payload: solvedPayload },
            bubbles: false,
          }),
        );
      }
    }, payload);

    await page.getByRole("button", { name: "Create Account" }).click();

    // After registration, redirected to home
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Step 2: Sign out via API (no sign-out UI in stub HomeView yet)
    await page.request.post("/api/auth/sign-out");

    // Step 3: Sign in
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByPlaceholder("Your password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // After sign-in, redirected to home
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("sign-in shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.getByPlaceholder("Your password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user is redirected to login from protected route", async ({ page }) => {
    // First ensure no session by calling sign-out
    await page.request.post("/api/auth/sign-out");

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
