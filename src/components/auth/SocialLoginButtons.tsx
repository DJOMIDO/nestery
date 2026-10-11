// src/components/auth/SocialLoginButtons.tsx
// "Or continue with" buttons on the login and signup pages, one per provider
// configured on the server. Renders nothing when none are.

"use client";

import { useTranslations } from "next-intl";
import { useAuthErrorText } from "@/components/auth/useAuthErrorText";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "@/components/auth/ProviderIcon";
import { useSocialProviders } from "@/components/auth/SocialProviders";
import { signInWithSocial } from "@/lib/auth-client";
import { SOCIAL_PROVIDER_LABELS, type SocialProviderId } from "@/lib/socialProviders";

export function SocialLoginButtons() {
  const providers = useSocialProviders();
  const [pending, setPending] = useState<SocialProviderId | null>(null);
  const t = useTranslations("auth");
  const errorText = useAuthErrorText();

  if (providers.length === 0) return null;

  const start = async (provider: SocialProviderId) => {
    setPending(provider);
    try {
      // Leaves for the provider's page and comes back to /dashboard
      await signInWithSocial(provider);
    } catch (error) {
      toast.error(errorText(error));
      setPending(null);
    }
  };

  return (
    <div className="pt-4 border-t text-center space-y-3">
      <p className="text-sm text-muted-foreground">{t("orContinue")}</p>
      <div className="space-y-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="outline"
            className="w-full flex items-center gap-2"
            onClick={() => start(provider)}
            disabled={pending !== null}
          >
            <ProviderIcon provider={provider} />
            {t("continueWith", { provider: SOCIAL_PROVIDER_LABELS[provider] })}
          </Button>
        ))}
      </div>
    </div>
  );
}
