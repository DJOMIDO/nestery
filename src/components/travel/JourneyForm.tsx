// src/components/travel/JourneyForm.tsx
// Add or edit a flight or train journey. The usual fields are shown; the
// rest is under "More details", opened automatically when any is filled in.

"use client";

import { useTranslations } from "next-intl";
import { useReminderLabel } from "@/components/travel/useReminderLabel";
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

// Each with its message in travel.form.required.<key>
const REQUIRED: { key: "carrier" | "number" | "origin" | "destination" | "departureDate"; flightsOnly?: boolean }[] = [
  { key: "carrier" },
  // Regional train tickets often have no number
  { key: "number", flightsOnly: true },
  { key: "origin" },
  { key: "destination" },
  { key: "departureDate" },
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
  const t = useTranslations("travel");
  const tCommon = useTranslations("common");
  const reminderLabel = useReminderLabel();
  const [remind, setRemind] = useState(() =>
    journey
      ? journey.remindBefore === null
        ? NO_REMINDER
        : String(journey.remindBefore)
      : String(DEFAULT_REMIND_BEFORE[kind])
  );
  // A value saved some other way (e.g. 45 minutes) stays selectable
  const remindOptions =
    REMINDER_OPTIONS.some((minutes) => String(minutes) === remind) || remind === NO_REMINDER
      ? REMINDER_OPTIONS
      : [...REMINDER_OPTIONS, Number(remind)];
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
        problems.push(
          t("form.incomplete", {
            end: key.startsWith("departure") ? "departure" : "arrival",
            part: key.endsWith("Date") ? "date" : "time",
          })
        );
      }
    }
    for (const { key, flightsOnly } of REQUIRED) {
      if ((!flightsOnly || isFlight) && !values[key].trim()) problems.push(t(`form.required.${key}`));
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
          <Label htmlFor="journey-carrier">{isFlight ? t("field.airline") : t("field.company")}</Label>
          {isFlight ? (
            <CodeInput
              id="journey-carrier"
              list="airlines"
              value={fields.carrier}
              onChange={set("carrier")}
              placeholder={t("form.airlinePlaceholder")}
              autoFocus={!journey}
            />
          ) : (
            <Input {...bind("carrier")} placeholder={t("form.example.company")} autoFocus={!journey} />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-number">{isFlight ? t("form.flightNumber") : t("form.trainNumber")}</Label>
          <Input {...bind("number")} placeholder={isFlight ? t("form.example.flightNumber") : t("form.example.trainNumber")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-origin">{t("form.from")}</Label>
          {isFlight ? (
            <CodeInput id="journey-origin" list="airports" value={fields.origin} onChange={set("origin")} placeholder={t("form.example.originAirport")} />
          ) : (
            <Input {...bind("origin")} placeholder={t("form.example.originStation")} />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-destination">{t("form.to")}</Label>
          {isFlight ? (
            <CodeInput
              id="journey-destination"
              list="airports"
              value={fields.destination}
              onChange={set("destination")}
              placeholder={t("form.example.destinationAirport")}
            />
          ) : (
            <Input {...bind("destination")} placeholder={t("form.example.destinationStation")} />
          )}
        </div>
      </div>

      {/* Times are local to each end (e.g. the arrival airport's time zone) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-departureDate">{t("form.departure")}</Label>
          <Input {...bindDateTime("departureDate")} type="date" />
          <Input {...bindDateTime("departureTime")} type="time" aria-label={t("form.departureTime")} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-arrivalDate">{t("form.arrival")}</Label>
          <Input {...bindDateTime("arrivalDate")} type="date" />
          <Input {...bindDateTime("arrivalTime")} type="time" aria-label={t("form.arrivalTime")} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t("form.localTimes")}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journey-seat">{t("field.seat")}</Label>
          <Input {...bind("seat")} placeholder={isFlight ? t("form.example.flightSeat") : t("form.example.trainSeat")} />
        </div>
        {!isFlight && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor="journey-coach">{t("field.coach")}</Label>
            <Input {...bind("coach")} placeholder={t("form.example.coach")} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="journey-remind">{t("form.remindMe")}</Label>
        <Select value={remind} onValueChange={setRemind} disabled={!fields.departureTime}>
          <SelectTrigger id="journey-remind" className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REMINDER}>{t("form.noReminder")}</SelectItem>
            {remindOptions.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {reminderLabel(minutes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {fields.departureTime
            ? t("form.reminderHint")
            : t("form.reminderNeedsTime")}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={showMore}
      >
        {showMore ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {t("form.moreDetails")}
      </button>

      {showMore && (
        <div className="space-y-4">
          {isFlight ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-stopover">{t("field.stopover")}</Label>
                  <CodeInput id="journey-stopover" list="airports" value={fields.stopover} onChange={set("stopover")} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-gate">{t("field.gate")}</Label>
                  <Input {...bind("gate")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-vehicle">{t("field.aircraft")}</Label>
                  <Input {...bind("vehicle")} placeholder={t("form.example.aircraft")} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-aircraftReg">{t("field.registration")}</Label>
                  <Input {...bind("aircraftReg")} placeholder={t("form.example.registration")} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="journey-vehicle">{t("field.trainType")}</Label>
                <Input {...bind("vehicle")} placeholder={t("form.example.trainType")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-originCity">{t("form.fromCity")}</Label>
                  <Input {...bind("originCity")} placeholder={t("form.example.originCity")} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="journey-destinationCity">{t("form.toCity")}</Label>
                  <Input {...bind("destinationCity")} placeholder={t("form.example.destinationCity")} />
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="journey-price">{t("field.price")}</Label>
              <Input {...bind("price")} type="number" min="0" step="0.01" inputMode="decimal" />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="journey-currency">{t("form.currency")}</Label>
              <Input {...bind("currency")} list="journey-currencies" placeholder={t("form.example.currency")} maxLength={3} />
              <datalist id="journey-currencies">
                {currencyList.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="journey-bookingRef">{t("form.bookingRef")}</Label>
            <Input {...bind("bookingRef")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="journey-notes">{t("form.notes")}</Label>
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
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          {saving ? tCommon("saving") : journey ? tCommon("save") : tCommon("add")}
        </Button>
      </div>
    </form>
  );
}
