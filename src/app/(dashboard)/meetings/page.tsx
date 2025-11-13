"use client";

import { useMemo, useState } from "react";
import { addMonths, format, isBefore, parseISO, startOfDay, startOfMonth } from "date-fns";
import { FilterIcon, Loader2Icon, PlusIcon } from "lucide-react";

import MeetingDialog from "@/components/meetings/MeetingDialog";
import MeetingDetailsDialog from "@/components/meetings/MeetingDetailsDialog";
import { getMeetingTypeLabel, meetingTypeStyles } from "@/components/meetings/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEETING_TYPES, type MeetingRecord, type MeetingTypeValue, MEETING_WINDOW, useMeetings } from "@/hooks/useMeetings";
import { cn } from "@/lib/utils";

type DateFilter = "all" | "upcoming" | "past";

type MonthBucket = {
  key: string;
  label: string;
  meetings: MeetingRecord[];
};

export default function MeetingsPage() {
  const {
    meetings,
    loading,
    error,
    creating,
    processingId,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getAllMeetings,
    getUpcomingMeetings,
    getPastMeetings,
  } = useMeetings();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter] = useState<MeetingTypeValue | "all">("all");

  const allMeetings = useMemo(() => {
    switch (dateFilter) {
      case "upcoming":
        return getUpcomingMeetings();
      case "past":
        return getPastMeetings();
      default:
        return getAllMeetings();
    }
  }, [dateFilter, getAllMeetings, getPastMeetings, getUpcomingMeetings]);

  const filteredMeetings = useMemo(() => {
    if (typeFilter === "all") {
      return allMeetings;
    }
    return allMeetings.filter(
      (meeting) => meeting.meeting_type === typeFilter
    );
  }, [allMeetings, typeFilter]);

  const monthBuckets = useMemo(() => {
    const buckets: MonthBucket[] = [];
    const bucketMap = new Map<string, MonthBucket>();
    const startMonth = startOfMonth(MEETING_WINDOW.start);

    for (let i = 0; i < 13; i += 1) {
      const reference = addMonths(startMonth, i);
      const key = format(reference, "yyyy-MM");
      const bucket: MonthBucket = {
        key,
        label: format(reference, "MMMM yyyy"),
        meetings: [],
      };
      buckets.push(bucket);
      bucketMap.set(key, bucket);
    }

    filteredMeetings.forEach((meeting) => {
      const meetingKey = format(parseISO(meeting.meeting_date), "yyyy-MM");
      const bucket = bucketMap.get(meetingKey);
      if (bucket) {
        bucket.meetings.push(meeting);
      }
    });

    return buckets;
  }, [filteredMeetings]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setSelectedMeeting(null);
    setDialogOpen(true);
  };

  const openEditDialog = (meeting: MeetingRecord) => {
    setDialogMode("edit");
    setSelectedMeeting(meeting);
    setDialogOpen(true);
  };

  const handleCardClick = (meeting: MeetingRecord) => {
    setSelectedMeeting(meeting);
    setDetailsOpen(true);
  };

  const handleDetailsOpenChange = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setSelectedMeeting(null);
    }
  };

  const activeMeetingId = selectedMeeting?.id ?? null;
  const isProcessing = !!activeMeetingId && processingId === activeMeetingId;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-16 pt-8">
      <div className="page-shell section-stack">
        <header className="flex flex-col gap-responsive sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-900">Meetings & Events</h1>
            <p className="text-sm text-muted-foreground">
              Plan ahead for the next 13 months, capture key details, and keep attendance on track.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className={cn("gap-2", dateFilter === "all" && "border-primary/50 text-primary")}
              onClick={() => setDateFilter("all")}
            >
              All
            </Button>
            <Button
              variant="outline"
              className={cn(
                "gap-2",
                dateFilter === "upcoming" && "border-primary/50 text-primary"
              )}
              onClick={() => setDateFilter("upcoming")}
            >
              Upcoming
            </Button>
            <Button
              variant="outline"
              className={cn("gap-2", dateFilter === "past" && "border-primary/50 text-primary")}
              onClick={() => setDateFilter("past")}
            >
              Past
            </Button>
            <Button onClick={openCreateDialog} className="gap-2">
              <PlusIcon className="size-4" />
              Create New Meeting
            </Button>
          </div>
        </header>

        <section className="section-card section-stack">
          <div className="flex flex-col items-start gap-responsive sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FilterIcon className="size-4" />
              Filter by type
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as MeetingTypeValue | "all")}
            >
              <SelectTrigger className="w-full sm:w-56 lg:w-48">
                <SelectValue placeholder="All meeting types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {MEETING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        {error && (
          <p className="rounded-lg border border-dashed border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2Icon className="mr-2 size-5 animate-spin" />
            Loading meeting calendar…
          </div>
        ) : (
          <div className="grid gap-responsive lg:grid-cols-2">
            {monthBuckets.map((bucket) => (
              <div
                key={bucket.key}
                className="flex flex-col gap-responsive rounded-xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {bucket.label}
                  </h2>
                  <Badge variant="secondary" className="bg-white text-slate-500">
                    {bucket.meetings.length} scheduled
                  </Badge>
                </div>
                <div className="space-y-4">
                  {bucket.meetings.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-muted-foreground">
                      No meetings captured yet
                    </div>
                  ) : (
                    bucket.meetings.map((meeting) => {
                      const meetingDate = parseISO(meeting.meeting_date);
                      const isPast = isBefore(startOfDay(meetingDate), startOfDay(new Date()));
                      const typeStyle =
                        meetingTypeStyles[
                          meeting.meeting_type as keyof typeof meetingTypeStyles
                        ] ?? meetingTypeStyles.business;
                      return (
                        <button
                          key={meeting.id}
                          type="button"
                          onClick={() => handleCardClick(meeting)}
                          className={cn(
                            "w-full rounded-xl border p-4 text-left transition-colors duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            isPast
                              ? "border-slate-200 bg-slate-100/70"
                              : "border-blue-100 bg-blue-50/60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">
                                {meeting.meeting_month} {meeting.meeting_year}
                              </p>
                              <p className="text-lg font-semibold text-slate-900">
                                {format(meetingDate, "d MMM yyyy")}
                              </p>
                            </div>
                            <Badge className={cn(typeStyle.badge)}>
                              {getMeetingTypeLabel(
                                meeting.meeting_type as keyof typeof meetingTypeStyles
                              )}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium text-slate-700">Location: </span>
                              {meeting.location ?? "To be confirmed"}
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">Notes: </span>
                              {meeting.notes ? (
                                <span className="line-clamp-2">{meeting.notes}</span>
                              ) : (
                                "No notes recorded"
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-sm font-medium text-slate-800">
                            <span>Attendees recorded</span>
                            <span>{meeting.attendanceSummary.total}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

          {!loading && filteredMeetings.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-slate-900">No meetings yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start planning by adding your first meeting between July 2025 and July 2026.
              </p>
              <Button className="mt-4 gap-2" onClick={openCreateDialog}>
                <PlusIcon className="size-4" />
                Create New Meeting
              </Button>
            </div>
          )}
        </section>

        <MeetingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={dialogMode}
          submitHandler={(values) =>
            dialogMode === "create"
              ? createMeeting(values)
              : selectedMeeting
                ? updateMeeting(selectedMeeting.id, values)
                : Promise.reject(new Error("No meeting selected"))
          }
          meeting={dialogMode === "edit" ? selectedMeeting : null}
          loading={
            dialogMode === "create"
              ? creating
              : selectedMeeting
              ? processingId === selectedMeeting.id
              : false
          }
        />

        <MeetingDetailsDialog
          open={detailsOpen}
          onOpenChange={handleDetailsOpenChange}
          meeting={selectedMeeting}
          onEdit={(meeting) => {
            setDetailsOpen(false);
            openEditDialog(meeting);
          }}
          onDelete={async (meeting) => {
            await deleteMeeting(meeting.id);
            if (selectedMeeting?.id === meeting.id) {
              setSelectedMeeting(null);
            }
          }}
          deleting={activeMeetingId ? processingId === activeMeetingId : false}
          processing={isProcessing}
        />
      </div>
    </div>
  );
}


