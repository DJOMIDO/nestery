// src/components/UserAvatar.tsx

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const getInitials = (fullName: string) => {
  const parts = fullName.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
};

// The user's photo, or their initials when there is none (or it fails to
// load). Size it with className, e.g. "size-8 text-sm".
export function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  // The image that failed, so a new one is tried again
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = image && failed !== image;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-bold text-white",
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a redirect to signed storage, or a provider's URL
        <img src={image} alt="" className="size-full object-cover" onError={() => setFailed(image)} />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
