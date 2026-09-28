// src/hooks/useStoredChoice.ts

import { useEffect, useState } from "react";

// A small UI choice (a view mode, say) remembered per browser. Storage can be
// unavailable (private mode, blocked site data), so it falls back to `initial`
// and only ever restores one of the allowed values.
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  initial: T
) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored && (allowed as readonly string[]).includes(stored)) setValue(stored as T);
    } catch {}
    // `allowed` is a constant list at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const change = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {}
  };

  return [value, change] as const;
}
