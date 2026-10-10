// src/lib/socialProviders.ts
// Social sign-in providers Nestery supports. Shared by the server (which ones
// are configured) and the UI (labels and button order), so keep it free of
// server-only imports.

export const SOCIAL_PROVIDERS = ["github", "google"] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number];

export const SOCIAL_PROVIDER_LABELS: Record<SocialProviderId, string> = {
  github: "GitHub",
  google: "Google",
};

export const isSocialProvider = (id: string): id is SocialProviderId =>
  (SOCIAL_PROVIDERS as readonly string[]).includes(id);
