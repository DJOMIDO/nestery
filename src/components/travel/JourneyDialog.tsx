// src/components/travel/JourneyDialog.tsx
"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JourneyForm } from "@/components/travel/JourneyForm";
import type { Journey, JourneyInput, JourneyKind } from "@/lib/travel";

interface JourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: JourneyKind;
  // Journey being edited; omit to add one
  journey?: Journey | null;
  onSubmit: (input: JourneyInput) => Promise<unknown>;
  // Editing only; the list has no delete button on small screens
  onDelete?: () => void;
}

export function JourneyDialog({ open, onOpenChange, kind, journey, onSubmit, onDelete }: JourneyDialogProps) {
  const noun = kind === "flight" ? "flight" : "train journey";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{journey ? `Edit ${noun}` : `Add a ${noun}`}</DialogTitle>
        </DialogHeader>
        {/* The content unmounts when closed, so the form resets on each open */}
        <JourneyForm
          key={journey?.id ?? kind}
          kind={kind}
          journey={journey}
          onCancel={() => onOpenChange(false)}
          extraActions={
            journey && onDelete ? (
              <Button type="button" variant="outline" onClick={onDelete}>
                <Trash2 className="mr-1 size-4" /> Delete
              </Button>
            ) : undefined
          }
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
