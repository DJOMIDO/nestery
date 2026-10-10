// src/app/manifest.ts
// Makes Nestery installable as an app (PWA): Dock, home screen, its own window.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nestery",
    short_name: "Nestery",
    description: "A calm, personal home for your tasks and notes.",
    id: "/",
    // Signed-out users are sent on to the login page by the middleware
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // The light theme's page background, as on the icons
    background_color: "#f5f6f0",
    theme_color: "#f5f6f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // More margin, for launchers that crop icons to a circle
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
