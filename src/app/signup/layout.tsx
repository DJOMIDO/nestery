// app/signup/layout.tsx

import { SocialProvidersProvider } from "@/components/auth/SocialProviders";
import { socialProviderIds } from "@/lib/auth";

// Tells the page which social sign-in buttons to show
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SocialProvidersProvider providers={socialProviderIds}>{children}</SocialProvidersProvider>;
}
