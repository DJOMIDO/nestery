// src/hooks/useShortcut.ts

import { useSyncExternalStore } from "react";

// The platform never changes while the page is open
const subscribe = () => () => {};

const isMac = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform: string } };
  return /mac|iphone|ipad/i.test(nav.userAgentData?.platform ?? nav.platform);
};

// Labels a Cmd/Ctrl shortcut the way the platform writes it: "⌘J" on Apple
// devices, "Ctrl+J" elsewhere. The server renders the Mac form; other
// platforms switch right after hydration.
export function useShortcut() {
  const mac = useSyncExternalStore(subscribe, isMac, () => true);
  return (key: string) => (mac ? `⌘${key}` : `Ctrl+${key}`);
}
