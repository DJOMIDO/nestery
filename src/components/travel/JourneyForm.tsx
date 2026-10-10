// src/components/travel/JourneyForm.tsx
// Add or edit a flight or train journey. The usual fields are shown; the
// rest is under "More details", opened automatically when any is filled in.

"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CodeInput } from "@/components/travel/CodeInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_REMIND_BEFORE,
  REMINDER_OPTIONS,
  reminderLabel,
  type Journey,
  type JourneyInput,
  type JourneyKind,
} from "@/lib/travel";

type Fields = Record<keyof Omit<JourneyInput, "kind" | "remindBefore">, string>;

// The reminder select's value: minutes, or "none"
const NO_REMINDER = "none";

const EMPTY: Fields = {
  carrier: "",
  number: "",
  origin: "",
  destination: "",
  stopover: "",
  originCity: "",
  destinationCity: "",
  departureDate: "",
  departureTime: "",
  arrivalDate: "",
  arrivalTime: "",
  seat: "",
  gate: "",
  coach: "",
  vehicle: "",
  aircraftReg: "",
  price: "",
  currency: "",
  bookingRef: "",
  notes: "",
};

// Date and time inputs are left to the browser (uncontrolled): Safari loses
// a date typed field by field when React writes the value back
const DATE_TIME_FIELDS = ["departureDate", "departureTime", "arrivalDate", "arrivalTime"] as const;

const REQUIRED: { key: keyof Fields; message: string; flightsOnly?: boolean }[] = [
  { key: "carrier", message: "Enter the airline or company" },
  // Regional train tickets often have no number
  { key: "number", message: "Enter the flight number", flightsOnly: true },
  { key: "origin", message: "Enter where you leave from" },
  { key: "destination", message: "Enter where you're going" },
  { key: "departureDate", message: "Enter the departure date" },
];

const MORE: Record<JourneyKind, (keyof Fields)[]> = {
  flight: ["stopover", "gate", "vehicle", "aircraftReg", "price", "currency", "bookingRef", "notes"],
  train: ["vehicle", "originCity", "destinationCity", "price", "currency", "bookingRef", "notes"],
};

const fromJourney = (j: Journey): Fields =>
  Object.fromEntries(Object.keys(EMPTY).map((k) => [k, j[k as keyof Fields] ?? ""])) as Fields;

// Every currency the browser knows, for suggestions
const currencies = () => {
  try {
    return Intl.supportedValuesOf("currency");
  } catch {
    return ["EUR", "USD", "GBP", "CNY", "JPY", "CHF"];
  }
};

interface JourneyFormProps {
  kind: JourneyKind;
  journey?: Journey | null;
  onSubmit: (input: JourneyInput) => Promise<unknown>;
  onCancel: () => void;
  // Shown on the left of the buttons, e.g. Delete
  extraActions?: React.ReactNode;
}

export function JourneyForm({ kind, journey, onSubmit, onCancel, extraActions }: JourneyFormProps) {
  const [fields, setFields] = useState<Fields>(() => (journey ? fromJourney(journey) : EMPTY));
  const [showMore, setShowMore] = useState(() => !!journey && MORE[kind].some((k) => journey[k]));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // New journeys start with the usual reminder for their kind
  const [remind, setRemind] = useState(() =>
    journey
      ? journey.remindBefore === null
        ? NO_REMINDER
        : String(journey.remindBefore)
      : String(DEFAULT_REMIND_BEFORE[kind])
  );
  // A value saved some other way (e.g. 45 minutes) stays selectable
  const remindOptions = REMINDER_OPTIONS.some((o) => String(o.minutes) === remind) || remind === NO_REMINDER
    ? REMINDER_OPTIONS
    : [...REMINDER_OPTIONS, { minutes: Number(remind), label: reminderLabel(Number(remind)) }];
  const formRef = useRef<HTMLFormElement>(null);
  const currencyList = useMemo(currencies, []);
  const isFlight = kind === "flight";

  const set = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));
  const bind = (key: keyof Fields) => ({
    id: `journey-${key}`,
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value),
  });
  const bindDateTime = (key: (typeof DATE_TIME_FIELDS)[number]) => ({
    id: `journey-${key}`,
    name: key,
    defaultValue: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key)(e.target.value),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read dates and times from the inputs themselves, and catch ones the
    // browser shows as filled but can't read (typed only partly)
    const values = { ...fields };
    const problems: string[] = [];
    for (const key of DATE_TIME_FIELDS) {
      const input = formRef.current?.elements.namedItem(key) as HTMLInputElement | null;
      if (!input) continue;
      values[key] = input.value;
      if (input.validity.badInput) {
        problems.push(`The ${key.startsWith("departure") ? "departure" : "arrival"} ${key.endsWith("Date") ? "date" : "time"} isn't complete`);
      }
    }
    for (const { key, message, flightsOnly } of REQUIRED) {
      if ((!flightsOnly || isFlight) && !values[key].trim()) problems.push(message);
    }
    setErrors(problems);
    if (problems.length) return;

    setSaving(true);
    const blankToNull = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()])
    ) as Record<keyof Fields, string | null>;
    await onSubmit({
      ...blankToNull,
      kind,
      carrier: values.carrier.trim(),
      number: values.number.trim(),
      origin: values.origin.trim(),
      destination: values.destination.trim(),
      departureDate: values.departureDate,
      remindBefore: remind === NO_REMINDER ? null : Number(remind),
    });
    setSaving(false);
  };

  return (
    // noValidate: required fields are checked above, the same in every browser
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-carrier">{isFlight ? "Airline" : "Company"}</Label>
          {isFlight ? (
            <CodeInput
              id="journey-carrier"
              list="airlines"
              value={fields.carrier}
              onChange={set("carrier")}
              placeholder="AF or Air France"
              autoFocus={!journey}
            />
          ) : (
            <Input {...bind("carrier")} placeholder="SNCF" autoFocus={!journey} />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-number">{isFlight ? "Flight number" : "Train number (if any)"}</Label>
          <Input {...bind("number")} placeholder={isFlight ? "1234" : "6201"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-origin">From</Label>
          {isFlight ? (
            <CodeInput id="journey-origin" list="airports" value={fields.origin} onChange={set("origin")} placeholder="CDG" />
          ) : (
            <Input {...bind("origin")} placeholder="Paris Gare de Lyon" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-destination">To</Label>
          {isFlight ? (
            <CodeInput
              id="journey-destination"
              list="airports"
              value={fields.destination}
              onChange={set("destination")}
              placeholder="PEK"
            />
          ) : (
            <Input {...bind("destination")} placeholder="Grenoble" />
          )}
        </div>
      </div>

      {/* Times are local to each end (e.g. the arrival airport's time zone) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-departureDate">Departure</Label>
          <Input {...bindDateTime("departureDate")} type="date" />
          <Input {...bindDateTime("departureTime")} type="time" aria-label="Departure time" />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-arrivalDate">Arrival</Label>
          <Input {...bindDateTime("arrivalDate")} type="date" />
          <Input {...bindDateTime("arrivalTime")} type="time" aria-label="Arrival time" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Local times at each end, as on the ticket.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-seat">Seat</Label>
          <Input {...bind("seat")} placeholder={isFlight ? "23A" : "54"} />
        </div>
        {!isFlight && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor="journey-coach">Coach</Label>
            <Input {...bind("coach")} placeholder="7" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="journey-remind">Remind me</Label>
        <Select value={remind} onValueChange={setRemind} disabled={!fields.departureTime}>
          <SelectTrigger id="journey-remind" className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REMINDER}>Don&apos;t remind me</SelectItem>
            {remindOptions.map((o) => (
              <SelectItem key={o.minutes} value={String(o.minutes)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {fields.departureTime
            ? "Shown on the dashboard's Reminders card, and as an alert in calendar apps subscribed to Nestery."
            : "Add a departure time to get a reminder."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={showMore}
      >
        {showMore ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        More details
      </button>

      {showMore && (
        <div className="space-y-4">
          {isFlight ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-stopover">Stopover</Label>
                  <CodeInput id="journey-stopover" list="airports" value={fields.stopover} onChange={set("stopover")} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-gate">Gate</Label>
                  <Input {...bind("gate")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-vehicle">Aircraft</Label>
                  <Input {...bind("vehicle")} placeholder="Airbus A350" />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-aircraftReg">Registration</Label>
                  <Input {...bind("aircraftReg")} placeholder="F-HTYA" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="journey-vehicle">Train type</Label>
                <Input {...bind("vehicle")} placeholder="TGV INOUI" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-originCity">From city</Label>
                  <Input {...bind("originCity")} placeholder="Paris" />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-destinationCity">To city</Label>
                  <Input {...bind("destinationCity")} placeholder="Grenoble" />
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="journey-price">Price</Label>
              <Input {...bind("price")} type="number" min="0" step="0.01" inputMode="decimal" />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="journey-currency">Currency</Label>
              <Input {...bind("currency")} list="journey-currencies" placeholder="EUR" maxLength={3} />
              <datalist id="journey-currencies">
                {currencyList.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="journey-bookingRef">Booking reference</Label>
            <Input {...bind("bookingRef")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="journey-notes">Notes</Label>
            <Textarea {...bind("notes")} />
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {extraActions && <div className="mr-auto">{extraActions}</div>}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          {saving ? "Saving…" : journey ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
