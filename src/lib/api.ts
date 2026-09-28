// src/lib/api.ts
// JSON fetch helper for the app's own API routes.

// Throws with the server's error message when the response is not ok
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}
