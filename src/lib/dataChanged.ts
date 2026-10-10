// src/lib/dataChanged.ts
// Lets code that saves data outside a page's own hooks (the assistant panel)
// tell open pages to reload it.

type DataKind = "tasks" | "events";

const EVENT_NAME = "nestery:data-changed";

export function notifyDataChanged(kind: DataKind) {
  window.dispatchEvent(new CustomEvent<DataKind>(EVENT_NAME, { detail: kind }));
}

// Calls `callback` whenever `kind` changes; returns the unsubscribe function
export function onDataChanged(kind: DataKind, callback: () => void) {
  const handler = (e: Event) => {
    if ((e as CustomEvent<DataKind>).detail === kind) callback();
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
