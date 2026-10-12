// src/hooks/useShortcut.ts

import { useSyncExternalStore } from "react";

// The platform never changes while the page is open
const subscribe = () => () => {};

const isMac = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform: string } };
  return /mac|iphone|ipad/i.test(nav.userAgentData?.platform ?? nav.platform);
};

// Whether shortcuts use ⌘ (Apple devices) rather than Ctrl. The server
// renders the Mac form; other platforms switch right after hydration.
export function useIsMac() {
  return useSyncExternalStore(subscribe, isMac, () => true);
}

// Labels a Cmd/Ctrl shortcut as plain text, for places that take only a
// string (title, aria-label): "⌘J" on Apple devices, "Ctrl+J" elsewhere.
// Text on the page uses <Shortcut> instead, which draws ⌘ in the system font.
export function useShortcut() {
  const mac = useIsMac();
  return (key: string) => (mac ? `⌘${key}` : `Ctrl+${key}`);
}
