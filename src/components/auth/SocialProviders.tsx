// src/components/auth/SocialProviders.tsx
// Which social sign-in providers are configured, passed down from the server
// (the auth page layouts) so buttons only show for working providers.

"use client";

import { createContext, useContext } from "react";

const SocialProvidersContext = createContext<string[]>([]);

export function SocialProvidersProvider({
  providers,
  children,
}: {
  providers: string[];
  children: React.ReactNode;
}) {
  return <SocialProvidersContext.Provider value={providers}>{children}</SocialProvidersContext.Provider>;
}

export const useSocialProviders = () => useContext(SocialProvidersContext);
