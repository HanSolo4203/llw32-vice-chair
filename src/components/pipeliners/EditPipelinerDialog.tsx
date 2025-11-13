"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  Loader2Icon,
  PencilIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { CharityEvent, PipelinerEligibility } from "@/types/database";

const NO_SPONSOR_VALUE = "none";

type MemberOption = {
  id: string;
  full_name: string;
  status: string | null;
};

type EditableCharityEvent = CharityEvent & {
  isDirty?: boolean;
  removeParticipation?: boolean;
};

type EditPipelinerDialogProps = {
  pipeliner: PipelinerEligibility | null;
  members: MemberOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<void> | void;
  onLogNewEvent?: () => void;
};

type PipelinerFormState = {
  fullName: string;
  email: string;
  phone: string;
  sponsoredBy: string;
  status: string;
  notes: string;
};

const DEFAULT_FORM: PipelinerFormState = {
  fullName: "",
  email: "",
  phone: "",
  sponsoredBy: NO_SPONSOR_VALUE,
  status: "active",
  notes: "",
};

export default function EditPipelinerDialog({
  pipeliner,
  members,
  open,
  onOpenChange,
  onUpdated,
  onLogNewEvent,
}: EditPipelinerDialogProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [form, setForm] = useState<PipelinerFormState>(DEFAULT_FORM);
  const [events, setEvents] = useState<EditableCharityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && pipeliner) {
      setForm({
        fullName: pipeliner.full_name,
        email: pipeliner.email ?? "",
        phone: pipeliner.phone ?? "",
        sponsoredBy: pipeliner.sponsored_by ?? NO_SPONSOR_VALUE,
        status: pipeliner.status ?? "active",
        notes: pipeliner.notes ?? "",
      });

      setLoadingEvents(true);
      supabase
        .from("charity_events")
        .select("id, event_name, event_date, description, participant_ids")
        .contains("participant_ids", [pipeliner.id])
        .order("event_date", { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          setEvents((data ?? []) as EditableCharityEvent[]);
        })
        .catch((error) => {
          console.error("Failed to load charity events", error);
          toast.error("Unable to load charity events for this pipeliner.");
        })
        .finally(() => setLoadingEvents(false));
    } else if (!open) {
      setEvents([]);
      setSaving(false);
    }
  }, [open, pipeliner, supabase]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status !== "inactive"),
    [members],
  );

  const handleEventFieldChange = useCallback(
    (eventId: string, field: keyof CharityEvent, value: string | null | string[]) => {
      setEvents((previous) =>
        previous.map((event) =>
          event.id === eventId
            ? {
                ...event,
                [field]: value,
                isDirty: field === "event_name" || field === "event_date" || field === "description" ? true : event.isDirty,
              }
            : event,
        ),
      );
    },
    [],
  );

  const handleRemoveParticipation = useCallback((eventId: string) => {
    setEvents((previous) =>
      previous.map((event) =>
        event.id === eventId
          ? {
              ...event,
              removeParticipation: !event.removeParticipation,
              isDirty: false,
            }
          : event,
      ),
    );
  }, []);

  const hasChanges =
    (pipeliner &&
      (form.fullName.trim() !== pipeliner.full_name ||
        form.email.trim() !== (pipeliner.email ?? "") ||
        form.phone.trim() !== (pipeliner.phone ?? "") ||
        (form.sponsoredBy === NO_SPONSOR_VALUE
          ? pipeliner.sponsored_by !== null && pipeliner.sponsored_by !== undefined
          : form.sponsoredBy !== (pipeliner.sponsored_by ?? "")) ||
        form.status !== (pipeliner.status ?? "active") ||
        form.notes.trim() !== (pipeliner.notes ?? ""))) ||
    events.some((event) => event.isDirty || event.removeParticipation);

  const handleSave = useCallback(async () => {
    if (!pipeliner) return;
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (!hasChanges) {
      toast.message("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const updates: Promise<unknown>[] = [];
      updates.push(
        supabase
          .from("pipeliners")
          .update({
            full_name: form.fullName.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            sponsored_by: form.sponsoredBy === NO_SPONSOR_VALUE ? null : form.sponsoredBy,
            status: form.status as PipelinerEligibility["status"],
            notes: form.notes.trim() || null,
          })
          .eq("id", pipeliner.id),
      );

      events.forEach((event) => {
        if (event.removeParticipation) {
          const participants = (event.participant_ids ?? []).filter((id) => id !== pipeliner.id);
          updates.push(
            supabase
              .from("charity_events")
              .update({
                participant_ids: participants.length > 0 ? participants : null,
              })
              .eq("id", event.id),
          );
        } else if (event.isDirty) {
          updates.push(
            supabase
              .from("charity_events")
              .update({
                event_name: event.event_name,
                event_date: event.event_date,
                description: event.description ?? null,
              })
              .eq("id", event.id),
          );
        }
      });

      await Promise.all(updates);
      toast.success("Pipeliner updated successfully.");
      await Promise.resolve(onUpdated?.());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update pipeliner", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to update the pipeliner right now.",
      );
    } finally {
      setSaving(false);
    }
  }, [events, form, hasChanges, onOpenChange, onUpdated, pipeliner, supabase]);

  const handleLogNewEvent = useCallback(() => {
    if (onLogNewEvent) {
      onOpenChange(false);
      onLogNewEvent();
    }
  }, [onLogNewEvent, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilIcon className="size-5 text-slate-500" />
            Edit Pipeliner
          </DialogTitle>
          <DialogDescription>
            Adjust pipeliner details and manage their charity event participation.
          </DialogDescription>
        </DialogHeader>

        {pipeliner ? (
          <div className="grid gap-6 py-2 md:grid-cols-[1.15fr_1fr]">
            <div className="space-y-4">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Profile Details
                </h3>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Full Name
                  <Input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    disabled={saving}
                    placeholder="Full name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Email
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    disabled={saving}
                    placeholder="pipeliner@example.com"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Phone
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    disabled={saving}
                    placeholder="+265 ..."
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Sponsored By
                  <Select
                    value={form.sponsoredBy}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        sponsoredBy: value || NO_SPONSOR_VALUE,
                      }))
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sponsor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SPONSOR_VALUE}>No sponsor</SelectItem>
                      {activeMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Status
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="eligible">Eligible</SelectItem>
                      <SelectItem value="became_member">Became Member</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    disabled={saving}
                    placeholder="Add any notes or mentorship updates"
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </section>
            </div>

            <div className="space-y-4">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Charity Events
                  </h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={handleLogNewEvent}
                    disabled={!onLogNewEvent}
                  >
                    <SparklesIcon className="size-4" />
                    Log new event
                  </Button>
                </div>

                {loadingEvents ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading events...
                  </div>
                ) : events.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-muted-foreground">
                    No charity events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => {
                      const participants = event.participant_ids ?? [];
                      const otherParticipants = participants.filter((id) => id !== pipeliner.id);
                      return (
                        <div
                          key={event.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-slate-800">
                              {event.event_name}
                            </h4>
                            <Button
                              type="button"
                              variant={event.removeParticipation ? "secondary" : "ghost"}
                              size="sm"
                              className="gap-1 text-rose-600"
                              onClick={() => handleRemoveParticipation(event.id)}
                            >
                              <TrashIcon className="size-4" />
                              {event.removeParticipation
                                ? "Undo removal"
                                : "Remove participation"}
                            </Button>
                          </div>

                          {event.removeParticipation ? (
                            <p className="mt-3 text-xs font-medium text-rose-600">
                              {otherParticipants.length > 0
                                ? "This pipeliner will be removed from the event."
                                : "This event will be cleared if no other participants remain."}
                            </p>
                          ) : (
                            <div className="mt-3 space-y-2 text-sm">
                              <label className="flex flex-col gap-1 font-medium text-slate-600">
                                Event Title
                                <Input
                                  value={event.event_name ?? ""}
                                  onChange={(ev) =>
                                    handleEventFieldChange(event.id, "event_name", ev.target.value)
                                  }
                                  disabled={saving}
                                />
                              </label>
                              <label className="flex flex-col gap-1 font-medium text-slate-600">
                                Event Date
                                <div className="relative">
                                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    type="date"
                                    value={event.event_date ?? ""}
                                    onChange={(ev) =>
                                      handleEventFieldChange(
                                        event.id,
                                        "event_date",
                                        ev.target.value,
                                      )
                                    }
                                    className="pl-10"
                                    disabled={saving}
                                  />
                                </div>
                              </label>
                              <label className="flex flex-col gap-1 font-medium text-slate-600">
                                Description (optional)
                                <textarea
                                  rows={2}
                                  value={event.description ?? ""}
                                  onChange={(ev) =>
                                    handleEventFieldChange(
                                      event.id,
                                      "description",
                                      ev.target.value || null,
                                    )
                                  }
                                  disabled={saving}
                                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </label>
                              {otherParticipants.length > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {otherParticipants.length} other participant
                                  {otherParticipants.length === 1 ? "" : "s"} remain linked to this
                                  event.
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-muted-foreground">
            Select a pipeliner to edit their profile.
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !pipeliner}>
            {saving ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <PencilIcon className="mr-2 size-4" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


