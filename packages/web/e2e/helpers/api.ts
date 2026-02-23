/**
 * API seed helpers for E2E tests.
 * These helpers call the server API directly (not via the browser) to set up test data.
 */

const API_BASE = "http://localhost:3000";

export interface SeedDocumentOptions {
  title?: string;
  /** Cookie string from an authenticated session */
  cookie: string;
}

export interface SeedDocumentResult {
  id: string;
  state: string;
}

/**
 * Creates a minimal document record in `draft` state via the API.
 * Returns the document id.
 */
export async function seedDraftDocument(opts: SeedDocumentOptions): Promise<SeedDocumentResult> {
  const { title = "E2E Test Document", cookie } = opts;

  // First, initiate an upload to get a document record created
  const initiateRes = await fetch(`${API_BASE}/api/documents/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      title,
      filename: "test-document.pdf",
      contentType: "application/pdf",
      contentLength: 1024,
      saveAsDraft: true,
    }),
  });

  if (!initiateRes.ok) {
    const text = await initiateRes.text();
    throw new Error(`Failed to initiate upload: ${initiateRes.status} — ${text}`);
  }

  const initiateData = (await initiateRes.json()) as {
    success: boolean;
    data: { documentId: string };
  };

  if (!initiateData.success) {
    throw new Error(`Initiate upload returned success=false`);
  }

  return { id: initiateData.data.documentId, state: "draft" };
}

/**
 * Moves a document to `moderator_review` state by directly calling the admin state update.
 * Requires an admin session cookie.
 */
export async function moveDocumentToModeratorReview(
  documentId: string,
  adminCookie: string,
): Promise<void> {
  // Submit the document first (draft → submitted)
  const submitRes = await fetch(`${API_BASE}/api/documents/${documentId}/submit`, {
    method: "POST",
    headers: { Cookie: adminCookie },
  });

  if (!submitRes.ok && submitRes.status !== 422) {
    // 422 may occur if state transition is invalid; best-effort
    throw new Error(`Failed to submit document: ${submitRes.status}`);
  }

  // Use admin endpoint to force state to moderator_review
  const stateRes = await fetch(`${API_BASE}/api/admin/documents/${documentId}/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ state: "moderator_review" }),
  });

  if (!stateRes.ok) {
    throw new Error(`Failed to force state to moderator_review: ${stateRes.status}`);
  }
}

/**
 * Gets the current session cookie string from a page.
 * Returns the raw Cookie header value.
 */
export async function getSessionCookie(
  fetch: (url: string, init?: RequestInit) => Promise<Response>,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Failed to sign in as ${email}: ${res.status}`);
  }

  const setCookieHeader = res.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No set-cookie header in sign-in response");
  }

  // Extract cookie name=value pairs
  return setCookieHeader
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}
