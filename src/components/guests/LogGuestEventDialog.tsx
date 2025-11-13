"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { GuestMeetingCounts } from "@/types/database";

type LogGuestEventDialogProps = {
  guest: GuestMeetingCounts | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => Promise<void> | void;
};

type GuestEventFormState = {
  eventName: string;
  eventDate: string;
  contribution: string;
};

function getToday(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

const initialState: GuestEventFormState = {
  eventName: "",
  eventDate: getToday(),
  contribution: "",
};

export default function LogGuestEventDialog({
  guest,
  open,
  onOpenChange,
  onCompleted,
}: LogGuestEventDialogProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [form, setForm] = useState<GuestEventFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm((previous) => ({
        ...previous,
        eventName: guest?.full_name ? `${guest.full_name} Support` : "",
        eventDate: getToday(),
        contribution: "",
      }));
      setSubmitting(false);
    } else {
      setForm(initialState);
    }
  }, [guest, open]);

  const handleSubmit = useCallback(async () => {
    if (!guest) {
      toast.error("Select a guest to log the event against.");
      return;
    }

    const trimmedName = form.eventName.trim();
    if (!trimmedName) {
      toast.error("Event name is required.");
      return;
    }

    if (!form.eventDate) {
      toast.error("Please choose the event date.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        guest_id: guest.id,
        event_name: trimmedName,
        event_date: form.eventDate,
        contribution: form.contribution.trim() ? form.contribution.trim() : null,
      };

      const { error } = await supabase.from("guest_events").insert(payload);
      if (error) {
        throw error;
      }

      toast.success("Guest event logged successfully.");
      await Promise.resolve(onCompleted?.());
      onOpenChange(false);
    } catch (error) {
      const supabaseError =
        error && typeof error === "object"
          ? (error as { message?: string; details?: string; hint?: string; code?: string })
          : undefined;

      console.error("Failed to log guest event", {
        error: supabaseError ?? error,
        guestId: guest?.id,
        payload: {
          guest_id: guest?.id,
          event_name: form.eventName.trim(),
          event_date: form.eventDate,
        },
      });

      const errorMessage =
        supabaseError?.message ??
        supabaseError?.details ??
        (error instanceof Error ? error.message : null) ??
        "Unable to log the guest event right now.";

      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [form.contribution, form.eventDate, form.eventName, guest, onCompleted, onOpenChange, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-amber-500" />
            Log Round Table Event
          </DialogTitle>
          <DialogDescription>
            Credit a guest for volunteering at a Round Table event or fundraiser. Event participation
            counts toward their journey to becoming a full member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
            {guest ? (
              <>
                <p>
                  <span className="font-semibold text-slate-900">{guest.full_name}</span> has attended{" "}
                  <span className="font-semibold text-slate-900">
                    {guest.meeting_count} meeting{guest.meeting_count === 1 ? "" : "s"}
                  </span>{" "}
                  and supported{" "}
                  <span className="font-semibold text-slate-900">
                    {guest.event_count} event{guest.event_count === 1 ? "" : "s"}
                  </span>
                  .
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Guests need both meeting experience and hands-on event support before promotion.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a guest to log their event contribution.
              </p>
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
              disabled={submitting}
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
                disabled={submitting}
                required
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Contribution (optional)
            <textarea
              value={form.contribution}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, contribution: event.target.value }))
              }
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Describe their role, hours, or impact."
              disabled={submitting}
            />
          </label>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !guest}>
            {submitting ? (
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


