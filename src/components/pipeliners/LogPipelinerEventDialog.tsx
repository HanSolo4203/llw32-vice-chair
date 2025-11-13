"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PipelinerEligibility } from "@/types/database";

type LogPipelinerEventDialogProps = {
  pipeliner: PipelinerEligibility | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: {
    pipelinerId: string;
    eventName: string;
    eventDate: string;
    notes: string;
  }) => Promise<void>;
  creating?: boolean;
};

type FormState = {
  eventName: string;
  eventDate: string;
  notes: string;
};

const today = () => new Date().toISOString().split("T")[0] ?? "";

const initialState: FormState = {
  eventName: "",
  eventDate: today(),
  notes: "",
};

export default function LogPipelinerEventDialog({
  pipeliner,
  open,
  onOpenChange,
  onCreate,
  creating = false,
}: LogPipelinerEventDialogProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        eventName: pipeliner?.full_name ? `${pipeliner.full_name} Round Table Support` : "",
        eventDate: today(),
        notes: "",
      });
      setSubmitting(false);
    } else {
      setForm(initialState);
    }
  }, [open, pipeliner]);

  const handleSubmit = useCallback(async () => {
    if (!pipeliner) {
      toast.error("Select a pipeliner before logging an event.");
      return;
    }

    const trimmedName = form.eventName.trim();
    if (!trimmedName) {
      toast.error("Event name is required.");
      return;
    }

    if (!form.eventDate) {
      toast.error("Please pick an event date.");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        pipelinerId: pipeliner.id,
        eventName: trimmedName,
        eventDate: form.eventDate,
        notes: form.notes.trim(),
      });
      toast.success("Pipeliner charity event logged.");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to log pipeliner event", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to log this event right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [form.eventDate, form.eventName, form.notes, onCreate, onOpenChange, pipeliner]);

  const disabled = submitting || creating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Round Table Event</DialogTitle>
          <DialogDescription>
            Credit a pipeliner for supporting a Round Table initiative. This updates their charity
            event progress instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
            {pipeliner ? (
              <>
                <p className="font-semibold text-slate-900">{pipeliner.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  Charity events completed: {pipeliner.charity_event_count ?? 0}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Select a pipeliner to continue.</p>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Event Name
            <textarea
              value={form.eventName}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, eventName: event.target.value }))
              }
              rows={2}
              placeholder="Describe the Round Table event or initiative"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Event Date
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={form.eventDate}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, eventDate: event.target.value }))
                }
                className="pl-10"
                disabled={disabled}
                required
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Notes (optional)
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, notes: event.target.value }))
              }
              rows={3}
              placeholder="Add context or impact details (optional)"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
            />
          </label>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={disabled || !pipeliner}>
            {disabled ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <SparklesIcon className="mr-2 size-4" />
            )}
            Log Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


