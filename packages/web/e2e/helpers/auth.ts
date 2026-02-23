import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { solveChallenge } from "altcha-lib";

const API_BASE = "http://localhost:3000";

/**
 * Fetches a fresh ALTCHA challenge from the API, solves it, and returns the
 * base64-encoded payload string ready to inject into the registration form.
 */
export async function solveAltchaChallenge(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/altcha/challenge`);
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

/**
 * Registers a new user via the browser (solving ALTCHA), then signs in.
 * Returns after the post-login redirect to "/".
 */
export async function registerAndSignIn(
  page: Page,
  opts: { email: string; password: string; name: string },
): Promise<void> {
  const payload = await solveAltchaChallenge();

  await page.goto("/register");
  await page.getByLabel("Name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByPlaceholder("Choose a strong password").fill(opts.password);
  await page.keyboard.press("Escape");

  // Wait for the ALTCHA widget to appear (challenge fetch in onMounted is async)
  await page.locator("altcha-widget").waitFor({ timeout: 10000 });

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
  await expect(page).toHaveURL("/", { timeout: 15000 });
}

/**
 * Signs in an existing user via the login page.
 */
export async function signIn(
  page: Page,
  opts: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(opts.email);
  await page.getByPlaceholder("Your password").fill(opts.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/", { timeout: 10000 });
}
