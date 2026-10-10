// src/components/travel/CodeInput.tsx
// A text input for an airport or airline code that suggests matches from the
// server's lists as you type (code, name or city). Any code can be typed;
// unknown ones are kept as they are.

"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/api";
import type { Airline, Airport } from "@/lib/travel";
import { cn } from "@/lib/utils";

type Suggestion = { code: string; label: string };

const toSuggestion = (item: Airport | Airline): Suggestion =>
  "timeZone" in item
    ? { code: item.iata, label: [item.name, item.city].filter(Boolean).join(", ") }
    : { code: item.iata, label: item.name };

interface CodeInputProps {
  id: string;
  list: "airports" | "airlines";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function CodeInput({ id, list, value, onChange, placeholder, className, autoFocus }: CodeInputProps) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Only search after the user types, not for a value loaded into the form
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!query?.trim()) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      request<(Airport | Airline)[]>(`/api/travel/${list}?q=${encodeURIComponent(query)}`)
        .then((items) => {
          if (cancelled) return;
          setSuggestions(items.map(toSuggestion));
          setActive(0);
        })
        .catch(() => !cancelled && setSuggestions([]));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, list]);

  const choose = (s: Suggestion) => {
    onChange(s.code);
    setQuery(null);
    setOpen(false);
  };

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Leave time for a click on a suggestion to land
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.code}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer gap-2 rounded px-2 py-1.5", i === active && "bg-muted")}
            >
              <span className="w-9 shrink-0 font-mono font-semibold">{s.code}</span>
              <span className="truncate text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
