// src/components/auth/SocialProviders.tsx
// Which social sign-in providers are configured, passed down from the server
// (the auth page layouts) so buttons only show for working providers.

"use client";

import { createContext, useContext } from "react";
import type { SocialProviderId } from "@/lib/socialProviders";

const SocialProvidersContext = createContext<SocialProviderId[]>([]);

export function SocialProvidersProvider({
  providers,
  children,
}: {
  providers: SocialProviderId[];
  children: React.ReactNode;
}) {
  return <SocialProvidersContext.Provider value={providers}>{children}</SocialProvidersContext.Provider>;
}

export const useSocialProviders = () => useContext(SocialProvidersContext);
