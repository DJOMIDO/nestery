// src/lib/api.ts
// JSON fetch helper for the app's own API routes.

// Set once the page is on its way to the login page
let redirecting = false;

// Throws with the server's error message when the response is not ok
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  // The session expired or was signed out elsewhere. The middleware only sees
  // that a session cookie exists, so the page itself loaded; send the user to
  // sign in again (once), rather than have every request fail with a toast.
  // The promise never settles, so callers neither show an error nor update.
  if (res.status === 401 && typeof window !== "undefined") {
    if (!redirecting) {
      redirecting = true;
      window.location.assign("/login");
    }
    return new Promise<T>(() => {});
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}
