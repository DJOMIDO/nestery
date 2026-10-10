// src/components/ServiceWorker.tsx

"use client";

import { useEffect } from "react";

// Registers public/sw.js, which shows an offline page when Nestery can't
// load. Production only: in development it would get in the way of reloads.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
