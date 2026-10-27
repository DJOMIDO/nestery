// src/components/assistant/AssistantPanel.tsx
// The chat panel that slides in from the right: full screen on phones, a
// floating card (normal or half the screen wide) on larger screens. Finished
// exchanges are saved on the server as conversations, which the history list
// restores; the provider's transcript never comes to the browser.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  CalendarDays,
  CloudSun,
  History,
  ListTodo,
  Maximize2,
  Minimize2,
  NotebookPen,
  Paperclip,
  Pencil,
  Plane,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormat } from "@/components/SettingsProvider";
import { AssistantMarkdown } from "@/components/assistant/AssistantMarkdown";
import type { AssistantDraft } from "@/components/assistant/AssistantProvider";
import { ProposalCard, type ProposalState } from "@/components/assistant/ProposalCard";
import {
  MAX_IMAGES,
  type AssistantImage,
  type AssistantProposal,
  type AssistantStatus,
  type AssistantStreamEvent,
  type ConversationSummary,
  type StoredConversation,
} from "@/lib/assistant";
import { isAttachableImage, prepareImage } from "@/lib/imageAttachment";
import { useStoredChoice } from "@/hooks/useStoredChoice";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";

type ChatItem =
  // `images`: what was attached, kept so the message can be edited and sent
  // again; `historyLength`: the saved transcript's length when this message
  // was sent, the anchor a retry or an edit rolls back to; `notesBefore`:
  // the proposal notes that went out with it. `messageId` is the saved
  // message's id, null while the exchange is still running or went unsaved.
  | {
      role: "user";
      text: string;
      images: { image: AssistantImage; preview: string }[];
      historyLength: number;
      notesBefore: string[];
      messageId: string | null;
    }
  | {
      role: "assistant";
      text: string;
      // A tool currently running, e.g. "Checking your tasks"
      status: string | null;
      proposals: { proposal: AssistantProposal; state: ProposalState }[];
      error: string | null;
      done: boolean;
      // Whether the exchange reached the saved conversation: unsaved ones
      // (interrupted, failed) replay without a server-side rollback
      saved: boolean;
      messageId: string | null;
      // A tool ran since the last text: the next text starts a new paragraph
      afterTool: boolean;
    };

// The saved conversation being chatted with; null until the first exchange
// is saved (its "done" event names it)
interface ConversationState {
  id: string;
  provider: string;
  model: string;
  transcriptLength: number;
}

// Models often send blank lines around their text (e.g. after thinking)
const tidy = (text: string) => text.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n");

// One per tool, with that tool's icon; the text is in messages
// (assistant.examples.<key>), so it's asked in the user's language
const EXAMPLES: { key: "tasks" | "calendar" | "weather" | "notes" | "trip"; icon: LucideIcon }[] = [
  { key: "tasks", icon: ListTodo },
  { key: "calendar", icon: CalendarDays },
  { key: "weather", icon: CloudSun },
  { key: "notes", icon: NotebookPen },
  { key: "trip", icon: Plane },
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
  const t = useTranslations("assistant");
  const format = useFormat();
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  // The saved conversation the panel is chatting with
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  // Outcomes of proposals, passed to the assistant with the next message
  const [notes, setNotes] = useState<string[]>([]);
  const [input, setInput] = useState("");
  // The user message being edited in place, and its new text
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  // Images to send with the next message
  const [attachments, setAttachments] = useState<{ id: number; image: AssistantImage; preview: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  // The history list, over the message list while open
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  // Remembered per browser; only applies from sm up
  const [width, setWidth] = useStoredChoice("assistant-width", ["normal", "wide"] as const, "normal");
  const wide = width === "wide";
  const fileRef = useRef<HTMLInputElement>(null);
  const attachId = useRef(0);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A loaded conversation whose transcript came from another provider cannot
  // be continued (the model would reject it); it stays readable
  const readOnly = !!conversation && !!status?.provider && conversation.provider !== status.provider;

  // Focus the message box with the cursor after any text (e.g. a draft)
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      const box = inputRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    });
  }, []);

  // Re-checked on every open: the user may have just saved a key in Settings.
  // The box is disabled until the status says the assistant is available, so
  // focus it again once that's known (on the first open, it isn't yet).
  useEffect(() => {
    if (!open) return;
    focusInput();
    request<AssistantStatus>("/api/assistant")
      .then((next) => {
        setStatus(next);
        focusInput();
      })
      .catch(() => setStatus(null));
  }, [open, focusInput]);

  useEffect(() => {
    if (!open) return;
    // Escape closes the history list before the panel
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (historyOpen) setHistoryOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, historyOpen]);

  useEffect(() => {
    // The history list starts at the top; the messages stay scrolled to the end
    listRef.current?.scrollTo({ top: historyOpen ? 0 : listRef.current.scrollHeight })
  }, [items, historyOpen]);

  // A draft from elsewhere in the app (e.g. "Paste booking" in Travel): put
  // it in the message box with the cursor at the end, ready to paste after
  useEffect(() => {
    if (!draft) return;
    setInput(draft.text);
    focusInput();
  }, [draft, focusInput]);

  // An untouched draft only makes sense where it was handed over (e.g. right
  // after "Paste booking"), so closing the panel drops it. Typed text stays.
  useEffect(() => {
    if (!open) setInput((current) => (draft && current === draft.text ? "" : current));
  }, [open, draft]);

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
        // The exchange reached the saved conversation; its message ids anchor
        // later rollbacks and proposal updates
        setConversation({
          id: event.conversationId,
          provider: event.provider,
          model: event.model,
          transcriptLength: event.transcriptLength,
        });
        setItems((prev) => {
          // The exchange's own pair is always the last two items
          const next = [...prev];
          for (let i = Math.max(0, next.length - 2); i < next.length; i++) {
            const item = next[i];
            if (item.role === "assistant" && !item.saved) {
              next[i] = { ...item, messageId: event.assistantMessageId, done: true, status: null, saved: true };
            } else if (item.role === "user" && !item.messageId) {
              next[i] = { ...item, messageId: event.userMessageId };
            }
          }
          return next;
        });
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
      toast.error(t("onlyImages"));
      return;
    }
    const room = MAX_IMAGES - attachments.length;
    if (images.length > room) toast.error(t("maxImages", { count: MAX_IMAGES }));
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
    if ((!message && sentImages.length === 0) || busy || readOnly) return;
    setInput("");
    setAttachments([]);
    const sentNotes = notes;
    setNotes([]);
    await runExchange({
      message,
      images: sentImages,
      sentNotes,
      historyLength: conversation?.transcriptLength ?? 0,
    });
  };

  // Appends the exchange to the list and streams the reply into it; the
  // server saves it to the conversation once it finished. Also used to
  // replay one after rewinding (retry, edit and send again).
  const runExchange = async ({
    message,
    images,
    sentNotes,
    historyLength,
  }: {
    message: string;
    images: { image: AssistantImage; preview: string }[];
    sentNotes: string[];
    historyLength: number;
  }) => {
    setBusy(true);
    setItems((prev) => [
      ...prev,
      { role: "user", text: message, images, historyLength, notesBefore: sentNotes, messageId: null },
      {
        role: "assistant",
        text: "",
        status: t("thinking"),
        proposals: [],
        error: null,
        done: false,
        saved: false,
        messageId: null,
        afterTool: false,
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;
    let failed = false;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation?.id ?? null,
          message,
          images: images.map((a) => a.image),
          notes: sentNotes,
        }),
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
        if (!failed && !controller.signal.aborted) updateLast(() => ({ error: t("interrupted") }));
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

  // Rolls the conversation back to just before one of its messages: the
  // exchange and everything after it leave the list, the saved conversation
  // is cut the same way, and the proposal notes return to what they were
  // when that message was sent. Returns what the replayed exchange needs,
  // or null while busy or when the server-side rollback failed.
  const rewind = async (index: number, text: string) => {
    if (busy) return null;
    const target = items[index];
    if (!target || target.role !== "user") return null;
    const reply = items[index + 1];
    // An exchange that never reached the saved conversation (interrupted,
    // failed) has nothing to cut there; replaying just replaces it here
    if (conversation && target.messageId && reply?.role === "assistant" && reply.saved) {
      try {
        await request(`/api/assistant/conversations/${conversation.id}/rollback`, {
          method: "POST",
          body: JSON.stringify({ messageIndex: index, historyLength: target.historyLength }),
        });
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
      setConversation({ ...conversation, transcriptLength: target.historyLength });
    }
    setItems((prev) => prev.slice(0, index));
    // Notes from proposals settled since then go too: their cards are gone,
    // and the replayed exchange sends this message's own notes again
    setNotes(target.notesBefore);
    return { message: text, images: target.images, sentNotes: target.notesBefore, historyLength: target.historyLength };
  };

  // Sends the same message again, as if the first reply never happened
  const retry = async (index: number) => {
    const target = items[index];
    const replay = await rewind(index, target?.text ?? "");
    if (replay) await runExchange(replay);
  };

  // Replaces a sent message's text and sends it again from that point
  const resend = async (index: number, text: string) => {
    const message = text.trim();
    if (!message) return;
    setEditing(null);
    const replay = await rewind(index, message);
    if (replay) await runExchange(replay);
  };

  const reset = () => {
    abortRef.current?.abort();
    setInput("");
    setItems([]);
    setConversation(null);
    setNotes([]);
    setAttachments([]);
    setEditing(null);
    setHistoryOpen(false);
  };

  const settle = useCallback((index: number, id: string, state: ProposalState, note?: string) => {
    let messageId: string | null = null;
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index || item.role !== "assistant") return item;
        messageId = item.messageId;
        return { ...item, proposals: item.proposals.map((p) => (p.proposal.id === id ? { ...p, state } : p)) };
      })
    );
    if (note) setNotes((prev) => [...prev, note]);
    // A saved card also settles in the conversation, so a reload shows the
    // same outcome; "saving" is a moment on the way and stays local
    if (messageId && state !== "saving") {
      request(`/api/assistant/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ proposalId: id, state, ...(note ? { note } : {}) }),
      }).catch(() => {});
    }
  }, []);

  // Restores a saved conversation into the panel; whether it can be continued
  // depends on the provider still matching (see readOnly)
  const loadConversation = async (summary: ConversationSummary) => {
    if (busy) return;
    try {
      const conv = await request<StoredConversation>(`/api/assistant/conversations/${summary.id}`);
      abortRef.current?.abort();
      setItems(
        conv.messages.flatMap((m): ChatItem[] =>
          m.role === "user"
            ? [
                {
                  role: "user",
                  text: m.text,
                  images: m.images.map((image) => ({ image, preview: `data:${image.mediaType};base64,${image.data}` })),
                  historyLength: m.historyLength ?? 0,
                  notesBefore: m.notes,
                  messageId: m.id,
                },
              ]
            : [
                {
                  role: "assistant",
                  text: m.text,
                  status: null,
                  proposals: m.proposals,
                  error: m.error,
                  done: true,
                  saved: true,
                  messageId: m.id,
                  afterTool: false,
                },
              ]
        )
      );
      setConversation({
        id: conv.id,
        provider: conv.provider,
        model: conv.model,
        transcriptLength: conv.transcriptLength,
      });
      setNotes(conv.pendingNotes);
      setInput("");
      setAttachments([]);
      setEditing(null);
      setHistoryOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) {
      request<ConversationSummary[]>("/api/assistant/conversations")
        .then(setConversations)
        .catch((err) => {
          toast.error((err as Error).message);
          setHistoryOpen(false);
        });
    }
  };

  const removeConversation = async (id: string) => {
    try {
      await request(`/api/assistant/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev?.filter((c) => c.id !== id) ?? null);
      // The conversation on screen goes back to being a new one
      if (conversation?.id === id) reset();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <aside
      aria-label={t("title")}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-elevated shadow-xl transition-all duration-200",
        // Floats 2rem from the screen's edges, like the dashboard's cards.
        // Normal is a chat window in the bottom corner; wide reaches the
        // middle of the screen and its full height.
        // Full screen on phones keeps clear of the status bar, the home
        // indicator (see the header and the form) and, sideways, the notch
        "max-sm:pl-[var(--safe-left)] max-sm:pr-[var(--safe-right)]",
        "sm:right-[calc(2rem+var(--safe-right))] sm:bottom-[calc(2rem+var(--safe-bottom))] sm:overflow-hidden sm:rounded-lg sm:border",
        wide
          ? "sm:top-[calc(2rem+var(--safe-top))] sm:w-[max(26rem,calc(50vw_-_2rem))]"
          : "sm:top-auto sm:h-[min(40rem,calc(100dvh_-_4rem_-_var(--safe-top)_-_var(--safe-bottom)))] sm:w-[26rem]",
        // Closed, it moves past the edge margin and its shadow too
        open ? "translate-x-0" : "translate-x-full sm:translate-x-[calc(100%_+_4rem)]",
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
      <header className="flex items-center gap-2 px-4 py-3 max-sm:pt-[calc(0.75rem+var(--safe-top))]">
        <Sparkles className="size-4 text-leaf" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">{t("title")}</h2>
          {status?.model && <p className="truncate text-xs text-muted-foreground">{status.model}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleHistory}
          disabled={busy}
          title={t("history")}
          className={cn(historyOpen && "bg-foreground/10 text-foreground")}
        >
          <History className="size-4" />
          <span className="sr-only">{t("history")}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={reset}
          disabled={busy || (items.length === 0 && !input && attachments.length === 0 && !conversation)}
          title={t("newChat")}
        >
          <RotateCcw className="size-4" />
          <span className="sr-only">{t("newChat")}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex"
          onClick={() => setWidth(wide ? "normal" : "wide")}
          title={wide ? t("narrower") : t("wider")}
        >
          {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          <span className="sr-only">{wide ? t("makeNarrower") : t("makeWider")}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} title={t("closeHint")}>
          <X className="size-4" />
          <span className="sr-only">{t("close")}</span>
        </Button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {historyOpen ? (
          // The saved conversations, over the current one
          <div className="space-y-1">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t("history")}</p>
            {conversations === null ? (
              <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                <Spinner className="size-3.5" /> {t("loadingHistory")}
              </p>
            ) : conversations.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">{t("noHistory")}</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md transition-colors hover:bg-foreground/5",
                    c.id === conversation?.id && "bg-foreground/5"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => loadConversation(c)}
                    disabled={busy}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-2 text-left disabled:opacity-50"
                  >
                    <span className="w-full truncate text-sm">{c.title ?? t("imageChat")}</span>
                    <span className="text-xs text-muted-foreground">
                      {format.relative(c.updatedAt)} · {c.model}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConversation(c.id)}
                    disabled={busy}
                    className="mr-1.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                    title={t("deleteChat")}
                    aria-label={t("deleteChat")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : status && !status.available ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t("needsModel")}</p>
            <p>
              {t.rich("addKey", {
                link: (chunks) => (
                  <Link href="/settings?section=assistant" onClick={onClose} className="text-leaf underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-6">
            <p className="text-base leading-relaxed text-muted-foreground">
              {t("intro")}
            </p>
            <div>
              <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{t("tryAsking")}</p>
              <ul>
                {EXAMPLES.map(({ key, icon: Icon }) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => send(t(`examples.${key}`))}
                      disabled={!status?.available}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-foreground/5 disabled:opacity-50"
                    >
                      <Icon className="size-4 shrink-0 text-leaf" />
                      {t(`examples.${key}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          // A question sits close to its answer; turns are further apart
          items.map((item, i) =>
            item.role === "user" ? (
              <div key={i} className="ml-auto mt-6 flex w-fit max-w-[85%] flex-col items-end gap-1.5 first:mt-0">
                {item.images.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {item.images.map((img, n) => (
                      // eslint-disable-next-line @next/next/no-img-element -- a local data URL
                      <img key={n} src={img.preview} alt={t("attachedImage")} className="h-20 max-w-40 rounded-md border object-cover" />
                    ))}
                  </div>
                )}
                {editing?.index === i ? (
                  // The bubble becomes a box again; sending replays from here
                  <div className="w-full min-w-64 rounded-2xl border bg-muted p-2 dark:bg-foreground/10">
                    <textarea
                      value={editing.text}
                      onChange={(e) => setEditing({ index: i, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          resend(i, editing.text);
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      rows={2}
                      maxLength={4000}
                      autoFocus
                      aria-label={t("message")}
                      className="max-h-40 w-full resize-none bg-transparent px-1.5 py-1 text-sm leading-5 outline-none [field-sizing:content]"
                    />
                    <div className="mt-1 flex justify-end gap-1.5">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        {t("cancel")}
                      </Button>
                      <Button type="button" size="sm" disabled={!editing.text.trim()} onClick={() => resend(i, editing.text)}>
                        <ArrowUp className="size-3.5" />
                        {t("send")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  item.text && (
                    <div className="group flex items-center gap-1">
                      {/* Editing a message replays the chat from there, so the
                          answer and everything after it are replaced */}
                      {!busy && !readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                          onClick={() => setEditing({ index: i, text: item.text })}
                          title={t("editHint")}
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">{t("edit")}</span>
                        </Button>
                      )}
                      <p className="whitespace-pre-wrap wrap-anywhere rounded-2xl bg-muted px-3.5 py-2 dark:bg-foreground/10 text-sm text-foreground">
                        {item.text}
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              // Replies are plain text; only proposals (to confirm, or saved) get a card
              <div key={i} className="mt-3 space-y-2 text-sm">
                {tidy(item.text) && <AssistantMarkdown text={tidy(item.text)} onNavigate={closeIfCovering} />}
                {item.status && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" /> {item.status}…
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
                {/* A failed reply, or the latest one, can be asked for again */}
                {!busy && !readOnly && (item.error || i === items.length - 1) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                    onClick={() => retry(i - 1)}
                    title={t("retryHint")}
                  >
                    <RotateCw className="size-3.5" />
                    {t("retry")}
                  </Button>
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
        className="p-3 max-sm:pb-[calc(0.75rem+var(--safe-bottom))]"
      >
        {readOnly && (
          <p className="mb-2 text-xs text-muted-foreground">{t("readOnlyChat")}</p>
        )}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL */}
                <img src={a.preview} alt={t("imageToSend")} className="size-14 rounded-md border object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                  aria-label={t("removeImage")}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* On the card's own white by day; a shade darker by night to stand out */}
        <div className="flex items-end gap-2 rounded-lg border p-2 focus-within:ring-2 focus-within:ring-ring/50 dark:bg-background">
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
            disabled={!status?.available || busy || readOnly || attachments.length >= MAX_IMAGES}
            title={t("attachImageHint")}
          >
            <Paperclip className="size-4" />
            <span className="sr-only">{t("attachImage")}</span>
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
            placeholder={t("placeholder")}
            aria-label={t("message")}
            disabled={!status?.available || readOnly}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none [field-sizing:content] disabled:opacity-50"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" onClick={() => abortRef.current?.abort()} title={t("stop")}>
              <Square className="size-3.5" />
              <span className="sr-only">{t("stop")}</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={(!input.trim() && attachments.length === 0) || !status?.available || readOnly}
              title={t("sendHint")}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">{t("send")}</span>
            </Button>
          )}
        </div>
        {status?.source === "server" && (
          <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
            {t("usage", { used: status.usedToday, limit: status.dailyLimit })}
          </p>
        )}
      </form>
    </aside>
  );
}
