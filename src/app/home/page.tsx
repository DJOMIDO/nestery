// app/home/page.tsx

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NatureScatter, NesteryMark } from "@/components/brand/NatureShapes";
import { FeatureShowcase } from "@/components/landing/FeaturePreviews";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";

export default function LandingPage() {
  const t = useTranslations("home");
  const tAuth = useTranslations("auth");
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 pt-[calc(4rem+var(--safe-top))] pb-[calc(4rem+var(--safe-bottom))] text-center">
      <NatureScatter seed={7} />
      {/* No settings before signing in: the language is picked here */}
      {/* Lower in iPhone home-screen apps, out of the blurred band under the status bar */}
      <LanguageSwitcher className="absolute top-[calc(1rem+var(--safe-top))] right-4 standalone:max-md:top-[calc(3.5rem+var(--safe-top))]" />

      <div className="relative w-full max-w-4xl space-y-8">
        <div className="flex items-center justify-center gap-2">
          <NesteryMark />
          <span className="text-xl font-bold tracking-tight">Nestery</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="w-40">
            <Link href="/signup">{t("getStarted")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-40">
            <Link href="/login">{tAuth("signIn")}</Link>
          </Button>
        </div>

        <div className="pt-4">
          <FeatureShowcase />
        </div>
      </div>
    </main>
  );
}
