"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarIcon, Loader2Icon, PencilIcon, SparklesIcon, TrashIcon } from "lucide-react";
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
import type { GuestEvent, GuestMeetingCounts } from "@/types/database";

const NO_SPONSOR_VALUE = "none";

type MemberOption = {
  id: string;
  full_name: string;
  status: string;
};

type EditableGuestEvent = GuestEvent & {
  isDirty?: boolean;
  isRemoved?: boolean;
};

type EditGuestDialogProps = {
  guest: GuestMeetingCounts | null;
  members: MemberOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<void> | void;
  onLogNewEvent?: () => void;
};

type GuestFormState = {
  fullName: string;
  email: string;
  phone: string;
  invitedBy: string;
  notes: string;
  status: string;
};

const DEFAULT_FORM: GuestFormState = {
  fullName: "",
  email: "",
  phone: "",
  invitedBy: NO_SPONSOR_VALUE,
  notes: "",
  status: "active",
};

export default function EditGuestDialog({
  guest,
  members,
  open,
  onOpenChange,
  onUpdated,
  onLogNewEvent,
}: EditGuestDialogProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [form, setForm] = useState<GuestFormState>(DEFAULT_FORM);
  const [events, setEvents] = useState<EditableGuestEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && guest) {
      setForm({
        fullName: guest.full_name ?? "",
        email: guest.email ?? "",
        phone: guest.phone ?? "",
        invitedBy: guest.invited_by ?? NO_SPONSOR_VALUE,
        notes: guest.notes ?? "",
        status: guest.status ?? "active",
      });
      setLoadingEvents(true);

      let cancelled = false;
      const fetchEvents = async () => {
        try {
          const { data, error } = await supabase
            .from("guest_events")
            .select("id, event_name, event_date, contribution")
            .eq("guest_id", guest.id)
            .order("event_date", { ascending: false });

          if (error) throw error;
          if (!cancelled) {
            setEvents((data ?? []) as EditableGuestEvent[]);
          }
        } catch (error) {
          if (!cancelled) {
            console.error("Failed to load guest events", error);
            toast.error("Unable to load guest events right now.");
          }
        } finally {
          if (!cancelled) {
            setLoadingEvents(false);
          }
        }
      };

      void fetchEvents();

      return () => {
        cancelled = true;
      };
    } else if (!open) {
      setEvents([]);
      setSaving(false);
    }
  }, [guest, open, supabase]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status !== "inactive"),
    [members],
  );

  const hasChanges =
    (guest &&
      (form.fullName.trim() !== (guest.full_name ?? "") ||
        form.email.trim() !== (guest.email ?? "") ||
        form.phone.trim() !== (guest.phone ?? "") ||
        (form.invitedBy === NO_SPONSOR_VALUE
          ? guest.invited_by !== null && guest.invited_by !== undefined
          : form.invitedBy !== (guest.invited_by ?? "")) ||
        form.notes.trim() !== (guest.notes ?? "") ||
        form.status !== (guest.status ?? "active"))) ||
    events.some((event) => event.isDirty || event.isRemoved);

  const handleEventFieldChange = useCallback(
    (eventId: string, field: keyof GuestEvent, value: string | null) => {
      setEvents((previous) =>
        previous.map((item) =>
          item.id === eventId
            ? {
                ...item,
                [field]: value,
                isDirty: field === "event_name" || field === "event_date" || field === "contribution" ? true : item.isDirty,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleRemoveEvent = useCallback((eventId: string) => {
    setEvents((previous) =>
      previous.map((item) => (item.id === eventId ? { ...item, isRemoved: !item.isRemoved, isDirty: false } : item)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!guest) return;
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
      const updates: PromiseLike<unknown>[] = [];

      const guestPayload = {
        full_name: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        invited_by: form.invitedBy === NO_SPONSOR_VALUE ? null : form.invitedBy,
        notes: form.notes.trim() || null,
        status: form.status as GuestMeetingCounts["status"],
      };

      updates.push(supabase.from("guests").update(guestPayload).eq("id", guest.id));

      events.forEach((event) => {
        if (event.isRemoved) {
          updates.push(supabase.from("guest_events").delete().eq("id", event.id));
        } else if (event.isDirty) {
          updates.push(
            supabase
              .from("guest_events")
              .update({
                event_name: event.event_name,
                event_date: event.event_date,
                contribution: event.contribution ?? null,
              })
              .eq("id", event.id),
          );
        }
      });

      await Promise.all(updates);
      toast.success("Guest updated successfully.");
      await Promise.resolve(onUpdated?.());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update guest", error);
      toast.error(error instanceof Error ? error.message : "Unable to update guest right now.");
    } finally {
      setSaving(false);
    }
  }, [events, form, guest, hasChanges, onOpenChange, onUpdated, supabase]);

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
            Edit Guest
          </DialogTitle>
          <DialogDescription>Update guest details and manage their Round Table events.</DialogDescription>
        </DialogHeader>

        {guest ? (
          <div className="grid gap-6 py-2 md:grid-cols-[1.15fr_1fr]">
            <div className="space-y-4">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Guest Profile
                </h3>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Full Name
                  <Input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    disabled={saving}
                    placeholder="Guest name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Email
                  <Input
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    disabled={saving}
                    placeholder="guest@example.com"
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
                  Invited By
                  <Select
                    value={form.invitedBy}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, invitedBy: value || NO_SPONSOR_VALUE }))
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sponsoring member" />
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
                      <SelectItem value="became_pipeliner">Became Pipeliner</SelectItem>
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
                    placeholder="Add internal notes about this guest"
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
                    No Round Table events logged yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
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
                            variant={event.isRemoved ? "secondary" : "ghost"}
                            size="sm"
                            className="gap-1 text-rose-600"
                            onClick={() => handleRemoveEvent(event.id)}
                          >
                            <TrashIcon className="size-4" />
                            {event.isRemoved ? "Undo removal" : "Remove"}
                          </Button>
                        </div>
                        {!event.isRemoved ? (
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
                                    handleEventFieldChange(event.id, "event_date", ev.target.value)
                                  }
                                  className="pl-10"
                                  disabled={saving}
                                />
                              </div>
                            </label>
                            <label className="flex flex-col gap-1 font-medium text-slate-600">
                              Contribution (optional)
                              <textarea
                                rows={2}
                                value={event.contribution ?? ""}
                                onChange={(ev) =>
                                  handleEventFieldChange(
                                    event.id,
                                    "contribution",
                                    ev.target.value || null,
                                  )
                                }
                                disabled={saving}
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </label>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-medium text-rose-600">
                            This event will be removed when you save changes.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-muted-foreground">
            Select a guest to edit their profile.
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
          <Button type="button" onClick={handleSave} disabled={saving || !guest}>
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


