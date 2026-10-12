// src/components/TagInput.tsx
// Tags as chips, for tasks and notes alike. Typing adds one on Enter, comma
// or space ("#" is optional); Backspace in the empty field removes the last.
// Suggestions come from the tags already on the user's tasks and notes.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { request } from "@/lib/api";
import { parseTags } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const MAX_TAGS = 10;
const MAX_LENGTH = 32;

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  // No border until hovered or focused, for a note's header
  bare?: boolean;
}

export function TagInput({ id, value, onChange, placeholder, className, bare = false }: TagInputProps) {
  const t = useTranslations("tags");
  const listId = useId();
  const [text, setText] = useState("");
  const [known, setKnown] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  // -1 until a suggestion is chosen with the arrows: Enter adds what was typed
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  // An input method (pinyin, kana…) is composing: its text, spaces included
  // ("ce s"), isn't typed yet, so nothing is split or added meanwhile
  const composing = useRef(false);
  const full = value.length >= MAX_TAGS;

  // The user's tags, loaded the first time the field is used
  const loadKnown = () => {
    if (known) return;
    request<{ tag: string; count: number }[]>("/api/tags")
      .then((rows) => setKnown(rows.map((r) => r.tag)))
      .catch(() => setKnown([]));
  };

  const query = text.trim().replace(/^#+/, "").toLowerCase();
  const suggestions = (known ?? [])
    .filter((tag) => !value.includes(tag) && (!query || tag.toLowerCase().includes(query)))
    // Those starting with what was typed first
    .sort((a, b) => Number(!a.toLowerCase().startsWith(query)) - Number(!b.toLowerCase().startsWith(query)))
    .slice(0, 8);
  const showList = open && !full && suggestions.length > 0;

  useEffect(() => setActive(-1), [query]);

  const add = (tags: string[]) => {
    const next = [...new Set([...value, ...tags.map((tag) => tag.slice(0, MAX_LENGTH))])].slice(0, MAX_TAGS);
    if (next.length !== value.length) onChange(next);
    setText("");
  };
  const commit = () => {
    const tags = parseTags(text);
    if (tags.length) add(tags);
  };

  // A pasted or composed list ("a, b c") becomes tags at once
  const take = (next: string) => {
    if (/[\s,，]/.test(next.trim())) add(parseTags(next.replace(/，/g, ",")));
    else setText(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keys that pick a candidate in an input method belong to it
    if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" && showList) {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && showList) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" || e.key === "," || e.key === "，" || (e.key === " " && text.trim())) {
      const chosen = showList && active >= 0 ? suggestions[active] : null;
      // Enter with nothing typed or chosen belongs to the form (or nothing)
      if (e.key === "Enter" && !text.trim() && !chosen) return;
      e.preventDefault();
      if (chosen && e.key === "Enter") add([chosen]);
      else commit();
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm",
          bare
            ? "-mx-2 border-transparent hover:border-border focus-within:border-border"
            : "focus-within:ring-2 focus-within:ring-ring/50"
        )}
        onClick={() => input.current?.focus()}
      >
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-0.5 rounded bg-bark-soft py-0.5 pr-0.5 pl-1.5 text-xs text-bark">
            #{tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((other) => other !== tag));
              }}
              className="rounded p-0.5 hover:bg-bark/15"
              aria-label={t("remove", { tag })}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!full && (
          <input
            ref={input}
            id={id}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              if (composing.current) setText(e.target.value);
              else take(e.target.value);
              setOpen(true);
            }}
            onCompositionStart={() => (composing.current = true)}
            onCompositionEnd={(e) => {
              composing.current = false;
              take(e.currentTarget.value);
            }}
            onFocus={() => {
              loadKnown();
              setOpen(true);
            }}
            onBlur={() => {
              if (!composing.current) commit();
              setOpen(false);
            }}
            onKeyDown={onKeyDown}
            placeholder={value.length ? undefined : placeholder}
            aria-label={t("add")}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("suggestions")}
          className="absolute top-full left-0 z-50 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag}
              role="option"
              aria-selected={i === active}
              // Before the field's blur, which would close the list
              onMouseDown={(e) => {
                e.preventDefault();
                add([tag]);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded px-2 py-1", i === active && "bg-leaf-soft text-leaf")}
            >
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
