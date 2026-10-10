// src/components/assistant/AssistantPanel.tsx
// The chat panel that slides in from the right. The conversation lives here
// only (not saved); the server streams the reply as JSON lines.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2, Paperclip, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AssistantMarkdown } from "@/components/assistant/AssistantMarkdown";
import type { AssistantDraft } from "@/components/assistant/AssistantProvider";
import { ProposalCard, type ProposalState } from "@/components/assistant/ProposalCard";
import {
  MAX_IMAGES,
  type AssistantImage,
  type AssistantProposal,
  type AssistantStatus,
  type AssistantStreamEvent,
} from "@/lib/assistant";
import { isAttachableImage, prepareImage } from "@/lib/imageAttachment";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";

type ChatItem =
  // `images`: previews (data URLs) of what was attached
  | { role: "user"; text: string; images: string[] }
  | {
      role: "assistant";
      text: string;
      // A tool currently running, e.g. "Checking your tasks"
      status: string | null;
      proposals: { proposal: AssistantProposal; state: ProposalState }[];
      error: string | null;
      done: boolean;
      // A tool ran since the last text: the next text starts a new paragraph
      afterTool: boolean;
    };

// Models often send blank lines around their text (e.g. after thinking)
const tidy = (text: string) => text.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n");

const EXAMPLES = [
  "What's left on my list this week?",
  "What's on my calendar tomorrow?",
  "Will it rain this weekend?",
  "What's in my notes?",
  "When's my next trip?",
];

export function AssistantPanel({
  open,
  draft,
  onClose,
}: {
  open: boolean;
  draft: AssistantDraft | null;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  // The provider's transcript, sent back with each message
  const [history, setHistory] = useState<unknown[]>([]);
  // Outcomes of proposals, passed to the assistant with the next message
  const [notes, setNotes] = useState<string[]>([]);
  const [input, setInput] = useState("");
  // Images to send with the next message
  const [attachments, setAttachments] = useState<{ id: number; image: AssistantImage; preview: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachId = useRef(0);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Re-checked on every open: the user may have just saved a key in Settings
  useEffect(() => {
    if (!open) return;
    request<AssistantStatus>("/api/assistant").then(setStatus).catch(() => setStatus(null));
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items]);

  // A draft from elsewhere in the app (e.g. "Paste booking" in Travel): put
  // it in the message box with the cursor at the end, ready to paste after
  useEffect(() => {
    if (!draft) return;
    setInput(draft.text);
    requestAnimationFrame(() => {
      const box = inputRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    });
  }, [draft]);

  // Changes the assistant item being streamed (always the last one)
  const updateLast = (change: (item: Extract<ChatItem, { role: "assistant" }>) => Partial<ChatItem>) =>
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, ...change(last) } as ChatItem];
    });

  const handleEvent = (event: AssistantStreamEvent) => {
    switch (event.type) {
      case "text":
        updateLast((item) => ({
          text: item.text + (item.afterTool && item.text.trim() ? "\n\n" : "") + event.text,
          status: null,
          afterTool: false,
        }));
        break;
      case "status":
        updateLast(() => ({ status: event.label, afterTool: true }));
        break;
      case "proposal":
        updateLast((item) => ({ proposals: [...item.proposals, { proposal: event.proposal, state: "pending" }] }));
        break;
      case "done":
        setHistory(event.history);
        updateLast(() => ({ done: true, status: null }));
        break;
      case "error":
        updateLast(() => ({ error: event.message, status: null }));
        break;
    }
  };

  // Shrinks and adds images (from the file picker, a paste or a drop)
  const attach = async (files: File[]) => {
    const images = files.filter(isAttachableImage);
    if (files.length > 0 && images.length === 0) {
      toast.error("Only images can be attached.");
      return;
    }
    const room = MAX_IMAGES - attachments.length;
    if (images.length > room) toast.error(`Attach at most ${MAX_IMAGES} images per message.`);
    for (const file of images.slice(0, Math.max(0, room))) {
      try {
        const prepared = await prepareImage(file);
        setAttachments((prev) =>
          prev.length < MAX_IMAGES ? [...prev, { id: ++attachId.current, ...prepared }] : prev
        );
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
    inputRef.current?.focus();
  };

  const send = async (text: string) => {
    const message = text.trim();
    const sentImages = attachments;
    if ((!message && sentImages.length === 0) || busy) return;
    setInput("");
    setAttachments([]);
    setBusy(true);
    const sentNotes = notes;
    setNotes([]);
    setItems((prev) => [
      ...prev,
      { role: "user", text: message, images: sentImages.map((a) => a.preview) },
      { role: "assistant", text: "", status: "Thinking", proposals: [], error: null, done: false, afterTool: false },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;
    let failed = false;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message, images: sentImages.map((a) => a.image), notes: sentNotes }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AssistantStreamEvent;
          if (event.type === "done") finished = true;
          if (event.type === "error") failed = true;
          handleEvent(event);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        failed = true;
        updateLast(() => ({ error: (err as Error).message }));
      }
    } finally {
      // Without "done" this exchange isn't remembered, so the notes go with
      // the next message instead
      if (!finished) {
        setNotes((prev) => [...sentNotes, ...prev]);
        if (!failed && !controller.signal.aborted) updateLast(() => ({ error: "The reply was interrupted." }));
      }
      updateLast(() => ({ status: null }));
      abortRef.current = null;
      setBusy(false);
      inputRef.current?.focus();
      request<AssistantStatus>("/api/assistant").then(setStatus).catch(() => {});
    }
  };

  // Following a link: on phones the panel covers the page, so it steps aside
  const closeIfCovering = useCallback(() => {
    if (!window.matchMedia("(min-width: 640px)").matches) onClose();
  }, [onClose]);

  const reset = () => {
    abortRef.current?.abort();
    setItems([]);
    setHistory([]);
    setNotes([]);
    setAttachments([]);
  };

  const settle = useCallback((index: number, id: string, state: ProposalState, note?: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index && item.role === "assistant"
          ? { ...item, proposals: item.proposals.map((p) => (p.proposal.id === id ? { ...p, state } : p)) }
          : item
      )
    );
    if (note) setNotes((prev) => [...prev, note]);
  }, []);

  return (
    <aside
      aria-label="Assistant"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-card shadow-xl transition-transform duration-200 sm:w-[26rem]",
        open ? "translate-x-0" : "translate-x-full",
        dragging && "ring-2 ring-inset ring-leaf"
      )}
      // Drop images anywhere on the panel
      onDragOver={(e) => {
        if (!status?.available || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!status?.available) return;
        e.preventDefault();
        setDragging(false);
        attach(Array.from(e.dataTransfer.files));
      }}
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-leaf" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">Assistant</h2>
          {status?.model && <p className="truncate text-xs text-muted-foreground">{status.model}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={reset} disabled={items.length === 0} title="New chat">
          <RotateCcw className="size-4" />
          <span className="sr-only">New chat</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {status && !status.available ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>The assistant needs an AI model to talk to.</p>
            <p>
              Add your own API key in{" "}
              <Link href="/settings?section=assistant" onClick={onClose} className="text-leaf underline">
                Settings › Assistant
              </Link>
              .
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about your tasks, calendar, notes or the weather. I can also prepare tasks and events for you to
              confirm.
            </p>
            <div className="flex flex-col items-start gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  disabled={!status?.available}
                  className="rounded-full border px-3 py-1 text-left text-xs hover:bg-muted disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // A question sits close to its answer; turns are further apart
          items.map((item, i) =>
            item.role === "user" ? (
              <div key={i} className="ml-auto mt-6 flex w-fit max-w-[85%] flex-col items-end gap-1.5 first:mt-0">
                {item.images.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {item.images.map((src, n) => (
                      // eslint-disable-next-line @next/next/no-img-element -- a local data URL
                      <img key={n} src={src} alt="Attached image" className="h-20 max-w-40 rounded-md border object-cover" />
                    ))}
                  </div>
                )}
                {item.text && (
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-leaf-soft px-3 py-2 text-sm text-foreground">
                    {item.text}
                  </p>
                )}
              </div>
            ) : (
              // Replies are plain text; only proposals (to confirm, or saved) get a card
              <div key={i} className="mt-3 space-y-2 text-sm">
                {tidy(item.text) && <AssistantMarkdown text={tidy(item.text)} onNavigate={closeIfCovering} />}
                {item.status && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> {item.status}…
                  </p>
                )}
                {item.proposals.map(({ proposal, state }) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    state={state}
                    onSettled={(next, note) => settle(i, proposal.id, next, note)}
                  />
                ))}
                {item.error && (
                  <p role="alert" className="text-xs text-destructive">
                    {item.error}
                  </p>
                )}
              </div>
            )
          )
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t p-3"
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL */}
                <img src={a.preview} alt="Image to send" className="size-14 rounded-md border object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                  aria-label="Remove image"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-lg border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/50">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              attach(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={!status?.available || busy || attachments.length >= MAX_IMAGES}
            title="Attach an image (or paste / drop one)"
          >
            <Paperclip className="size-4" />
            <span className="sr-only">Attach an image</span>
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            // Pasting a screenshot attaches it; pasted text goes in as usual
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.some(isAttachableImage)) {
                e.preventDefault();
                attach(files);
              }
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line (not while composing CJK text)
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask anything…"
            aria-label="Message"
            disabled={!status?.available}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none [field-sizing:content] disabled:opacity-50"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" onClick={() => abortRef.current?.abort()} title="Stop">
              <Square className="size-3.5" />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={(!input.trim() && attachments.length === 0) || !status?.available}
              title="Send (Enter)"
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
        {status?.source === "server" && (
          <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
            {status.usedToday} / {status.dailyLimit} messages today
          </p>
        )}
      </form>
    </aside>
  );
}
