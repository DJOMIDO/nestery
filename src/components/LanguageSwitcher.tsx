// src/components/LanguageSwitcher.tsx
// Language picker for signed-out pages (home, sign-in…), where there are no
// settings yet. Stores the choice in the cookie requests read; signing in
// later keeps it as the account's language (see SettingsProvider).

"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("common");

  const choose = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* A pill of its own, above the pages' background shapes, so it
            reads on any of them */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "z-10 gap-1.5 rounded-full border bg-background/85 text-foreground backdrop-blur-sm hover:bg-background",
            className
          )}
          aria-label={t("language")}
        >
          <Languages className="size-4" />
          {LOCALE_NAMES[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Each language in its own words */}
        {LOCALES.map((value) => (
          <DropdownMenuItem key={value} onSelect={() => choose(value)} lang={value}>
            <Check className={cn("size-4", value === locale ? "opacity-100" : "opacity-0")} />
            {LOCALE_NAMES[value]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
