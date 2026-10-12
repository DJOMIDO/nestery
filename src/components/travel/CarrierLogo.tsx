// src/components/travel/CarrierLogo.tsx
// An airline's or train company's logo on a white tile, so brand colours
// read in both themes. From public/carriers (`npm run travel:logos`) when
// there is one. Other airlines take Google Flights' logo images, which
// cover nearly every airline but are no public API; if one fails to load,
// the airline's code shows instead. Other train companies show initials.

"use client";

import { useState } from "react";
import codes from "@/lib/carrierLogos.json";
import { railLogo } from "@/lib/railOperators";
import type { JourneyKind } from "@/lib/travel";
import { cn } from "@/lib/utils";

const WITH_LOGO = new Set<string>(codes);

// "Deutsche Bahn" -> "DB", "SNCF" -> "SNCF" (at most four letters)
const initials = (carrier: string) => {
  const words = carrier.trim().split(/\s+/).filter(Boolean);
  const text = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "");
  return text.slice(0, 4).toUpperCase();
};

export function CarrierLogo({
  kind,
  carrier,
  name,
  className,
}: {
  kind: JourneyKind;
  carrier: string;
  // The airline's name, for the image's description
  name?: string;
  className?: string;
}) {
  const code = carrier.toUpperCase();
  // The carrier whose image failed, so another one (after an edit) is tried
  const [failed, setFailed] = useState<string | null>(null);
  const src =
    failed === carrier
      ? null
      : kind === "train"
        ? railLogo(carrier)
        : !/^[A-Z0-9]{2}$/.test(code)
          ? null
          : WITH_LOGO.has(code)
            ? `/carriers/${code}.svg`
            : `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`;
  return (
    <div
      className={cn(
        // Square for symbols; wordmarks (many train companies') widen it
        "flex h-10 min-w-10 max-w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white px-1.5",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small static logo
        <img
          src={src}
          alt={name ?? carrier}
          className="h-3/4 w-auto max-w-full object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailed(carrier)}
        />
      ) : (
        <span className="text-[0.65rem] font-bold tracking-tight text-forest">
          {kind === "flight" ? code : initials(carrier)}
        </span>
      )}
    </div>
  );
}
