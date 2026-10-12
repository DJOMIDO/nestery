// src/components/travel/JourneyDialog.tsx
// Adding a flight or a train journey. Existing journeys open their details
// (JourneyDetailPanel), which edit in place.
"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JourneyForm } from "@/components/travel/JourneyForm";
import type { JourneyInput, JourneyKind } from "@/lib/travel";

interface JourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: JourneyKind;
  onSubmit: (input: JourneyInput) => Promise<unknown>;
}

export function JourneyDialog({ open, onOpenChange, kind, onSubmit }: JourneyDialogProps) {
  const t = useTranslations("travel");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "flight" ? t("addFlight") : t("addTrain")}</DialogTitle>
        </DialogHeader>
        {/* The content unmounts when closed, so the form resets on each open */}
        <JourneyForm
          key={kind}
          kind={kind}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (input) => {
            const result = await onSubmit(input);
            if (result) onOpenChange(false);
            return result;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
