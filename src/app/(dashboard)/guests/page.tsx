"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  DownloadIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCcwIcon,
  SearchIcon,
  SparklesIcon,
  UserPlusIcon,
} from "lucide-react";

import AddGuestDialog from "@/components/guests/AddGuestDialog";
import EditGuestDialog from "@/components/guests/EditGuestDialog";
import PromoteToPipelinerDialog from "@/components/guests/PromoteToPipelinerDialog";
import LogGuestEventDialog from "@/components/guests/LogGuestEventDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { GuestMeetingCounts } from "@/types/database";

type GuestStatusFilter = "all" | "active" | "became_pipeliner" | "inactive";

type MemberOption = {
  id: string;
  full_name: string;
  status: string;
};

const STATUS_OPTIONS: { value: GuestStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "became_pipeliner", label: "Became Pipeliner" },
  { value: "inactive", label: "Inactive" },
];

function normalize(value: string | null | undefined) {
  return value?.toLowerCase() ?? "";
}

export default function GuestsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [guests, setGuests] = useState<GuestMeetingCounts[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<GuestStatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<GuestMeetingCounts | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eventDialogGuest, setEventDialogGuest] = useState<GuestMeetingCounts | null>(null);
  const [editDialogGuest, setEditDialogGuest] = useState<GuestMeetingCounts | null>(null);

  const fetchMembers = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setMembersLoading(true);
      }
      try {
        const { data, error: membersError } = await supabase
          .from("members")
          .select("id, full_name, status")
          .order("full_name", { ascending: true });

        if (membersError) {
          throw membersError;
        }

        const mapped =
          (data ?? []).map((member) => ({
            id: member.id,
            full_name: member.full_name ?? "Unnamed member",
            status: member.status ?? "active",
          })) ?? [];

        setMembers(mapped);
      } catch (fetchError) {
        console.error("Failed to load members", fetchError);
      } finally {
        if (!options?.silently) {
          setMembersLoading(false);
        }
      }
    },
    [supabase],
  );

  const fetchGuests = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setLoading(true);
        setError(null);
      }

      try {
        const { data, error: guestsError } = await supabase
          .from("guest_meeting_counts")
          .select("*")
          .order("meeting_count", { ascending: false })
          .order("full_name", { ascending: true });

        if (guestsError) {
          throw guestsError;
        }

        setGuests((data ?? []) as GuestMeetingCounts[]);
      } catch (fetchError) {
        console.error("Failed to load guests", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to fetch guests right now.",
        );
      } finally {
        if (!options?.silently) {
          setLoading(false);
        }
      }
    },
    [supabase],
  );

  useEffect(() => {
    void fetchGuests();
    void fetchMembers();
  }, [fetchGuests, fetchMembers]);

  const memberLookup = useMemo(() => {
    const map = new Map<string, MemberOption>();
    members.forEach((member) => {
      map.set(member.id, member);
    });
    return map;
  }, [members]);

  const filteredGuests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return guests.filter((guest) => {
      const matchesSearch =
        !term ||
        normalize(guest.full_name).includes(term) ||
        normalize(guest.email).includes(term) ||
        normalize(guest.phone).includes(term) ||
        normalize(memberLookup.get(guest.invited_by ?? "")?.full_name).includes(term);

      const matchesStatus =
        statusFilter === "all" ? true : guest.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [guests, memberLookup, searchTerm, statusFilter]);

  const eligibleCount = useMemo(
    () => guests.filter((guest) => guest.eligible_for_pipeliner).length,
    [guests],
  );

  const handleOpenDialog = useCallback((guest: GuestMeetingCounts) => {
    setSelectedGuest(guest);
    setDialogOpen(true);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (filteredGuests.length === 0) return;

    const rows = [
      [
        "Name",
        "Email",
        "Phone",
        "Invited By",
        "Meetings Attended",
        "Events Supported",
        "Status",
      ],
      ...filteredGuests.map((guest) => [
        guest.full_name,
        guest.email ?? "",
        guest.phone ?? "",
        memberLookup.get(guest.invited_by ?? "")?.full_name ?? "",
        guest.meeting_count.toString(),
        guest.event_count?.toString() ?? "0",
        guest.status,
      ]),
    ];

    const csvContent = rows
      .map((row) =>
        row
          .map((value) => `"${value.replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `guests-${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredGuests, memberLookup]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchGuests({ silently: true }),
        fetchMembers({ silently: true }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchGuests, fetchMembers]);

  const renderStatusBadge = useCallback((guest: GuestMeetingCounts) => {
    const baseClass =
      guest.status === "inactive"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : guest.status === "became_pipeliner"
          ? "border-purple-200 bg-purple-100 text-purple-700"
          : "border-emerald-200 bg-emerald-100 text-emerald-700";

    return (
      <Badge className={cn(baseClass, "capitalize")}>
        {guest.status.replaceAll("_", " ")}
      </Badge>
    );
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Guest Pipeline
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Track guest engagement, identify pipeliner-ready prospects, and keep their contact
            details up to date.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={!filteredGuests.length}>
            <DownloadIcon className="size-4" />
            Export to CSV
          </Button>
          <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <UserPlusIcon className="size-4" />
            Add New Guest
          </Button>
        </div>
      </header>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-4 pb-0 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Guest Directory
          </CardTitle>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <div className="relative flex-1 md:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search guests..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as GuestStatusFilter)}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Eligible guests</p>
              <p className="text-xs text-muted-foreground">
                {eligibleCount} guest{eligibleCount === 1 ? "" : "s"} ready for pipeliner promotion.
              </p>
              <p className="mt-1 text-xs font-medium text-amber-600">
                Requirement: 3 meetings attended and at least 1 Round Table event supported.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                {eligibleCount} eligible
              </Badge>
              <Badge variant="secondary" className="bg-white text-slate-500">
                {filteredGuests.length} shown
              </Badge>
              <Button
                variant="ghost"
                className="gap-2"
                onClick={refreshData}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <RefreshCcwIcon className="size-4 text-muted-foreground" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead className="text-center">Meetings</TableHead>
                  <TableHead className="text-center">Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 8 }).map((_, columnIndex) => (
                        <TableCell key={columnIndex}>
                          <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No guests found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGuests.map((guest) => {
                    const invitedBy = memberLookup.get(guest.invited_by ?? "")?.full_name ?? "—";
                    const eligible = guest.eligible_for_pipeliner;
                    const needsEvent = guest.event_count === 0;
                    return (
                      <TableRow key={guest.id}>
                        <TableCell className="font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {guest.full_name}
                            {eligible ? (
                              <Badge className="gap-1 border-emerald-200 bg-emerald-100 text-emerald-700">
                                <SparklesIcon className="size-3" />
                                Eligible!
                              </Badge>
                            ) : needsEvent && guest.meeting_count >= 3 ? (
                              <Badge className="gap-1 border-amber-200 bg-amber-100 text-amber-700">
                                Needs Event
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{guest.email ?? "—"}</TableCell>
                        <TableCell>{guest.phone ?? "—"}</TableCell>
                        <TableCell>{invitedBy}</TableCell>
                        <TableCell className="text-center">{guest.meeting_count}</TableCell>
                        <TableCell className="text-center">{guest.event_count}</TableCell>
                        <TableCell>{renderStatusBadge(guest)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-2"
                              onClick={() => setEventDialogGuest(guest)}
                              disabled={guest.status !== "active"}
                            >
                              <SparklesIcon className="size-4" />
                              Log Event
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => setEditDialogGuest(guest)}
                            >
                              <PencilIcon className="size-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              disabled={!eligible || guest.status === "became_pipeliner"}
                              onClick={() => handleOpenDialog(guest)}
                            >
                              <ArrowUpRightIcon className="size-4" />
                              Promote
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                ))
              : filteredGuests.map((guest) => {
                  const invitedBy = memberLookup.get(guest.invited_by ?? "")?.full_name ?? "—";
                  const eligible = guest.eligible_for_pipeliner;
                  const needsEvent = guest.event_count === 0;
                  return (
                    <div key={guest.id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {guest.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Invited by {invitedBy}
                          </p>
                        </div>
                        {eligible ? (
                          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                            Eligible!
                          </Badge>
                        ) : needsEvent && guest.meeting_count >= 3 ? (
                          <Badge className="border-amber-200 bg-amber-100 text-amber-700">
                            Needs Event
                          </Badge>
                        ) : null}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                          <dt className="font-medium text-slate-700">Email</dt>
                          <dd>{guest.email ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-700">Phone</dt>
                          <dd>{guest.phone ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-700">Meetings</dt>
                          <dd>{guest.meeting_count}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-700">Events</dt>
                          <dd>{guest.event_count}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-700">Status</dt>
                          <dd>{guest.status.replaceAll("_", " ")}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button
                          className="w-full gap-2"
                          variant="secondary"
                          size="sm"
                          onClick={() => setEventDialogGuest(guest)}
                          disabled={guest.status !== "active"}
                        >
                          <SparklesIcon className="size-4" />
                          Log Event
                        </Button>
                        <Button
                          className="w-full gap-2"
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditDialogGuest(guest)}
                        >
                          <PencilIcon className="size-4" />
                          Edit Guest
                        </Button>
                        <Button
                          className="w-full gap-2"
                          variant="outline"
                          size="sm"
                          disabled={!eligible || guest.status === "became_pipeliner"}
                          onClick={() => handleOpenDialog(guest)}
                        >
                          <ArrowUpRightIcon className="size-4" />
                          Promote to Pipeliner
                        </Button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </CardContent>
      </Card>

      <PromoteToPipelinerDialog
        guest={selectedGuest}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={members}
        onPromoted={refreshData}
      />
      <LogGuestEventDialog
        guest={eventDialogGuest}
        open={Boolean(eventDialogGuest)}
        onOpenChange={(open) => {
          if (!open) {
            setEventDialogGuest(null);
          }
        }}
        onCompleted={() => {
          void refreshData();
        }}
      />

      <AddGuestDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        members={members}
        onCreated={refreshData}
      />

      <EditGuestDialog
        guest={editDialogGuest}
        members={members}
        open={Boolean(editDialogGuest)}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogGuest(null);
          }
        }}
        onUpdated={refreshData}
        onLogNewEvent={
          editDialogGuest
            ? () => {
                setEventDialogGuest(editDialogGuest);
              }
            : undefined
        }
      />

      {(loading || membersLoading) && guests.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading guest records…
        </div>
      )}
    </div>
  );
}


