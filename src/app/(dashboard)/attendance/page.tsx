"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  CheckIcon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  MapPinIcon,
  UserCheckIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, isAfter, parseISO } from "date-fns";

import MemberAttendanceCard from "@/components/attendance/MemberAttendanceCard";
import GuestAttendanceItem from "@/components/attendance/GuestAttendanceItem";
import PipelinerAttendanceItem from "@/components/attendance/PipelinerAttendanceItem";
import QuickAddGuestForm, {
  type QuickAddGuestFormValues,
} from "@/components/attendance/QuickAddGuestForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getMeetingTypeLabel, meetingTypeStyles } from "@/components/meetings/constants";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useMeetings } from "@/hooks/useMeetings";
import { useMembers } from "@/hooks/useMembers";
import type {
  Attendance,
  GuestMeetingCounts,
  PipelinerEligibility,
} from "@/types/database";

const AUTO_SAVE_DELAY = 5_000;

type MemberStatusAction = {
  value: Attendance["status"];
  label: string;
  Icon: typeof CheckIcon;
  activeClass: string;
  baseClass: string;
};

const MEMBER_STATUS_ACTIONS: MemberStatusAction[] = [
  {
    value: "present",
    label: "Present",
    Icon: CheckIcon,
    activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700",
    baseClass:
      "border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100/80",
  },
  {
    value: "apology",
    label: "Apology",
    Icon: AlertTriangleIcon,
    activeClass: "border-amber-500 bg-amber-50 text-amber-800",
    baseClass:
      "border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-100/80",
  },
  {
    value: "absent",
    label: "Absent",
    Icon: XIcon,
    activeClass: "border-rose-500 bg-rose-50 text-rose-700",
    baseClass:
      "border-rose-200 text-rose-600 hover:border-rose-400 hover:bg-rose-100/80",
  },
];

type MemberStatusButtonsProps = {
  status: Attendance["status"] | null;
  disabled?: boolean;
  onChange: (next: Attendance["status"] | null) => void;
};

function MemberStatusButtons({
  status,
  disabled = false,
  onChange,
}: MemberStatusButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MEMBER_STATUS_ACTIONS.map(({ value, label, Icon, activeClass, baseClass }) => {
        const isActive = status === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(isActive ? null : value)}
            className={cn(
              "inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40",
              "bg-white",
              disabled && "pointer-events-none opacity-50",
              isActive ? activeClass : baseClass,
            )}
            disabled={disabled}
          >
            <Icon className="mr-1.5 size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

type AttendanceUpsertInput = {
  id?: string | null;
  meeting_id: string;
  status: Attendance["status"];
  member_id?: string | null;
  guest_id?: string | null;
  pipeliner_id?: string | null;
};

type SaveAttendanceResponse = {
  success: boolean;
  records: Array<{
    id: string;
    status: Attendance["status"];
    member_id: string | null;
    guest_id: string | null;
    pipeliner_id: string | null;
  }>;
  deletedIds: string[];
  error?: string;
};

type MemberAttendanceEntry = {
  attendanceId: string | null;
  status: Attendance["status"] | null;
};

type GuestAttendanceEntry = {
  attendanceId: string | null;
  attended: boolean;
};

type PipelinerAttendanceEntry = {
  attendanceId: string | null;
  attended: boolean;
};

function snapshotMemberAttendance(map: Record<string, MemberAttendanceEntry>) {
  const clone: Record<string, MemberAttendanceEntry> = {};
  for (const [id, entry] of Object.entries(map)) {
    clone[id] = {
      attendanceId: entry.attendanceId,
      status: entry.status,
    };
  }
  return clone;
}

function snapshotGuestAttendance(map: Record<string, GuestAttendanceEntry>) {
  const clone: Record<string, GuestAttendanceEntry> = {};
  for (const [id, entry] of Object.entries(map)) {
    clone[id] = {
      attendanceId: entry.attendanceId,
      attended: entry.attended,
    };
  }
  return clone;
}

function snapshotPipelinerAttendance(
  map: Record<string, PipelinerAttendanceEntry>,
) {
  const clone: Record<string, PipelinerAttendanceEntry> = {};
  for (const [id, entry] of Object.entries(map)) {
    clone[id] = {
      attendanceId: entry.attendanceId,
      attended: entry.attended,
    };
  }
  return clone;
}

function computeSummary(
  memberEntries: Record<string, MemberAttendanceEntry>,
  guestEntries: Record<string, GuestAttendanceEntry>,
  pipelinerEntries: Record<string, PipelinerAttendanceEntry>,
) {
  let present = 0;
  let apology = 0;
  let absent = 0;

  for (const entry of Object.values(memberEntries)) {
    if (entry.status === "present") present += 1;
    else if (entry.status === "apology") apology += 1;
    else if (entry.status === "absent") absent += 1;
  }

  for (const entry of Object.values(guestEntries)) {
    if (entry.attended) present += 1;
  }

  for (const entry of Object.values(pipelinerEntries)) {
    if (entry.attended) present += 1;
  }

  return { present, apology, absent };
}

export default function AttendancePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const {
    meetings,
    loading: meetingsLoading,
    error: meetingsError,
  } = useMeetings();
  const {
    members,
    loading: membersLoading,
    error: membersError,
  } = useMembers();
  const membersAlphabetical = useMemo(
    () =>
      [...members].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, {
          sensitivity: "base",
        }),
      ),
    [members],
  );

  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [memberViewMode, setMemberViewMode] = useState<"grid" | "list">("grid");
  const [memberAttendance, setMemberAttendance] = useState<
    Record<string, MemberAttendanceEntry>
  >({});
  const [guestAttendance, setGuestAttendance] = useState<
    Record<string, GuestAttendanceEntry>
  >({});
  const [pipelinerAttendance, setPipelinerAttendance] = useState<
    Record<string, PipelinerAttendanceEntry>
  >({});

  const memberInitialRef = useRef<Record<string, MemberAttendanceEntry>>({});
  const guestInitialRef = useRef<Record<string, GuestAttendanceEntry>>({});
  const pipelinerInitialRef = useRef<
    Record<string, PipelinerAttendanceEntry>
  >({});

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const [guests, setGuests] = useState<GuestMeetingCounts[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [promotingGuestId, setPromotingGuestId] = useState<string | null>(null);

  const [pipelinerEligibility, setPipelinerEligibility] = useState<
    PipelinerEligibility[]
  >([]);
  const [pipelinerLoading, setPipelinerLoading] = useState(false);
  const [pipelinerError, setPipelinerError] = useState<string | null>(null);
  const [promotingPipelinerId, setPromotingPipelinerId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errorRecords, setErrorRecords] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveScheduled, setAutoSaveScheduled] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedMeeting = selectedMeetingId
    ? meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null
    : null;

  useEffect(() => {
    if (!meetings.length) return;
    setSelectedMeetingId((current) => {
      if (current) return current;
      const today = new Date();
      const upcoming = meetings.find((meeting) => {
        const meetingDate = parseISO(meeting.meeting_date);
        return (
          isAfter(meetingDate, today) ||
          meetingDate.toDateString() === today.toDateString()
        );
      });
      return upcoming?.id ?? meetings[meetings.length - 1]?.id ?? "";
    });
  }, [meetings]);

  const loadGuests = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setGuestLoading(true);
      }
      setGuestError(null);
      try {
        const { data, error } = await supabase
          .from("guest_meeting_counts")
          .select("*")
          .order("meeting_count", { ascending: false })
          .order("full_name", { ascending: true })
          .returns<GuestMeetingCounts[]>();

        if (error) {
          throw error;
        }

        setGuests(data ?? []);
      } catch (error) {
        console.error("Failed to load guest list", error);
        setGuestError(
          error instanceof Error
            ? error.message
            : "Unable to load guests at the moment.",
        );
      } finally {
        if (!options?.silently) {
          setGuestLoading(false);
        }
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadGuests();
  }, [loadGuests]);

  const loadPipeliners = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPipelinerLoading(true);
      }
      setPipelinerError(null);
      try {
        const { data, error } = await supabase
          .from("pipeliner_eligibility")
          .select("*")
          .order("full_name", { ascending: true })
          .returns<PipelinerEligibility[]>();

        if (error) {
          throw error;
        }

        setPipelinerEligibility(data ?? []);
      } catch (error) {
        console.error("Failed to load pipeliners", error);
        setPipelinerError(
          error instanceof Error
            ? error.message
            : "Unable to load pipeliners right now.",
        );
      } finally {
        if (!options?.silently) {
          setPipelinerLoading(false);
        }
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadPipeliners();
  }, [loadPipeliners]);

  const loadAttendance = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!selectedMeetingId) {
        setMemberAttendance({});
        setGuestAttendance({});
        setPipelinerAttendance({});
        memberInitialRef.current = {};
        guestInitialRef.current = {};
        pipelinerInitialRef.current = {};
        return;
      }

      if (!options?.silently) {
        setAttendanceLoading(true);
        setAttendanceError(null);
      }

      try {
        const { data, error } = await supabase
          .from("attendance")
          .select("id, member_id, guest_id, pipeliner_id, status")
          .eq("meeting_id", selectedMeetingId);

        if (error) {
          throw error;
        }

        const memberMap: Record<string, MemberAttendanceEntry> = {};
        const guestMap: Record<string, GuestAttendanceEntry> = {};
        const pipelinerMap: Record<string, PipelinerAttendanceEntry> = {};

        for (const row of data ?? []) {
          if (row.member_id) {
            memberMap[row.member_id] = {
              attendanceId: row.id,
              status: row.status as Attendance["status"],
            };
          } else if (row.guest_id) {
            guestMap[row.guest_id] = {
              attendanceId: row.id,
              attended: row.status === "present",
            };
          } else if (row.pipeliner_id) {
            pipelinerMap[row.pipeliner_id] = {
              attendanceId: row.id,
              attended: row.status === "present",
            };
          }
        }

        setMemberAttendance(memberMap);
        memberInitialRef.current = snapshotMemberAttendance(memberMap);

        setGuestAttendance(guestMap);
        guestInitialRef.current = snapshotGuestAttendance(guestMap);

        setPipelinerAttendance(pipelinerMap);
        pipelinerInitialRef.current = snapshotPipelinerAttendance(pipelinerMap);
      } catch (error) {
        console.error("Failed to load attendance records", error);
        setAttendanceError(
          error instanceof Error
            ? error.message
            : "Unable to load attendance data for this meeting.",
        );
      } finally {
        if (!options?.silently) {
          setAttendanceLoading(false);
        }
      }
    },
    [selectedMeetingId, supabase],
  );

  useEffect(() => {
    if (!selectedMeetingId) return;
    void loadAttendance();
  }, [selectedMeetingId, loadAttendance]);

  useEffect(() => {
    if (members.length === 0) return;
    setMemberAttendance((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const member of members) {
        if (!next[member.id]) {
          const initial =
            memberInitialRef.current[member.id] ?? {
              attendanceId: null,
              status: null,
            };
          next[member.id] = {
            attendanceId: initial.attendanceId,
            status: initial.status,
          };
          memberInitialRef.current[member.id] = { ...initial };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [members]);

  useEffect(() => {
    if (guests.length === 0) return;
    setGuestAttendance((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const guest of guests) {
        if (!next[guest.id]) {
          const initial =
            guestInitialRef.current[guest.id] ?? {
              attendanceId: null,
              attended: false,
            };
          next[guest.id] = {
            attendanceId: initial.attendanceId,
            attended: initial.attended,
          };
          guestInitialRef.current[guest.id] = { ...initial };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [guests]);

  useEffect(() => {
    if (pipelinerEligibility.length === 0) return;
    setPipelinerAttendance((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const pipeliner of pipelinerEligibility) {
        if (!next[pipeliner.id]) {
          const initial =
            pipelinerInitialRef.current[pipeliner.id] ?? {
              attendanceId: null,
              attended: false,
            };
          next[pipeliner.id] = {
            attendanceId: initial.attendanceId,
            attended: initial.attended,
          };
          pipelinerInitialRef.current[pipeliner.id] = { ...initial };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pipelinerEligibility]);

  const handleMemberStatusChange = useCallback(
    (memberId: string, nextStatus: Attendance["status"] | null) => {
      setMemberAttendance((prev) => {
        const existing =
          prev[memberId] ??
          memberInitialRef.current[memberId] ?? {
            attendanceId: null,
            status: null,
          };
        return {
          ...prev,
          [memberId]: {
            attendanceId:
              existing.attendanceId ??
              memberInitialRef.current[memberId]?.attendanceId ??
              null,
            status: nextStatus,
          },
        };
      });
    },
    [],
  );

  const handleMarkAllPresent = useCallback(() => {
    setMemberAttendance((prev) => {
      const next = { ...prev };
      for (const member of members) {
        const existing =
          next[member.id] ??
          memberInitialRef.current[member.id] ?? {
            attendanceId: null,
            status: null,
          };
        next[member.id] = {
          attendanceId:
            existing.attendanceId ??
            memberInitialRef.current[member.id]?.attendanceId ??
            null,
          status: "present",
        };
      }
      return next;
    });
  }, [members]);

  const handleGuestToggle = useCallback((guestId: string, attended: boolean) => {
    setGuestAttendance((prev) => {
      const existing =
        prev[guestId] ??
        guestInitialRef.current[guestId] ?? {
          attendanceId: null,
          attended: false,
        };
      return {
        ...prev,
        [guestId]: {
          attendanceId:
            existing.attendanceId ??
            guestInitialRef.current[guestId]?.attendanceId ??
            null,
          attended,
        },
      };
    });
  }, []);

  const handlePipelinerToggle = useCallback(
    (pipelinerId: string, attended: boolean) => {
      setPipelinerAttendance((prev) => {
        const existing =
          prev[pipelinerId] ??
          pipelinerInitialRef.current[pipelinerId] ?? {
            attendanceId: null,
            attended: false,
          };
        return {
          ...prev,
          [pipelinerId]: {
            attendanceId:
              existing.attendanceId ??
              pipelinerInitialRef.current[pipelinerId]?.attendanceId ??
              null,
            attended,
          },
        };
      });
    },
    [],
  );

  const hasUnsavedMemberChanges = useMemo(
    () =>
      members.some((member) => {
        const current = memberAttendance[member.id]?.status ?? null;
        const initial = memberInitialRef.current[member.id]?.status ?? null;
        return current !== initial;
      }),
    [members, memberAttendance],
  );

  const hasUnsavedGuestChanges = useMemo(
    () =>
      guests.some((guest) => {
        const current = guestAttendance[guest.id]?.attended ?? false;
        const initial = guestInitialRef.current[guest.id]?.attended ?? false;
        return current !== initial;
      }),
    [guests, guestAttendance],
  );

  const hasUnsavedPipelinerChanges = useMemo(
    () =>
      pipelinerEligibility.some((pipeliner) => {
        const current = pipelinerAttendance[pipeliner.id]?.attended ?? false;
        const initial =
          pipelinerInitialRef.current[pipeliner.id]?.attended ?? false;
        return current !== initial;
      }),
    [pipelinerEligibility, pipelinerAttendance],
  );

  const hasUnsavedChanges =
    hasUnsavedMemberChanges ||
    hasUnsavedGuestChanges ||
    hasUnsavedPipelinerChanges;

  const membersPresent = useMemo(
    () =>
      members.reduce(
        (count, member) =>
          memberAttendance[member.id]?.status === "present" ? count + 1 : count,
        0,
      ),
    [members, memberAttendance],
  );

  const totalMembers = members.length;
  const isListView = memberViewMode === "list";

  const meetingOptions = useMemo(
    () =>
      meetings.map((meeting) => {
        const meetingDate = parseISO(meeting.meeting_date);
        return {
          id: meeting.id,
          label: `${format(meetingDate, "d MMM yyyy")} • ${
            meeting.location ?? "Location TBC"
          }`,
          secondary: format(meetingDate, "EEEE"),
        };
      }),
    [meetings],
  );

  const currentSummary = useMemo(
    () =>
      computeSummary(memberAttendance, guestAttendance, pipelinerAttendance),
    [memberAttendance, guestAttendance, pipelinerAttendance],
  );

  const handleAddGuest = useCallback(
    async (values: QuickAddGuestFormValues) => {
      if (!values.full_name.trim()) {
        toast.error("Guest name is required.");
        return;
      }

      setCreatingGuest(true);
      try {
        const payload = {
          full_name: values.full_name.trim(),
          email: values.email.trim() || null,
          phone: values.phone.trim() || null,
          status: "active",
          first_attendance: selectedMeeting?.meeting_date ?? null,
        };

        const { error } = await supabase.from("guests").insert(payload);
        if (error) throw error;

        await loadGuests({ silently: true });
        toast.success("Guest added.");
      } catch (error) {
        console.error("Failed to add guest", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not add the guest. Please try again.",
        );
      } finally {
        setCreatingGuest(false);
      }
    },
    [loadGuests, selectedMeeting?.meeting_date, supabase],
  );

  const handlePromoteGuest = useCallback(
    async (guest: GuestMeetingCounts) => {
      setPromotingGuestId(guest.id);
      try {
        const { error } = await supabase.from("pipeliners").insert({
          full_name: guest.full_name,
          email: guest.email,
          phone: guest.phone,
          guest_meetings_count: guest.meeting_count,
          business_meetings_count: guest.present_count,
          charity_events_count: guest.charity_event_count ?? 0,
          status: "prospect",
          is_eligible_for_membership: true,
          notes: guest.notes,
          sponsored_by: guest.invited_by,
        });
        if (error) throw error;

        toast.success(`${guest.full_name} promoted to Pipeliner.`);
        await loadPipeliners({ silently: true });
      } catch (error) {
        console.error("Failed to promote guest", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to promote guest right now.",
        );
      } finally {
        setPromotingGuestId(null);
      }
    },
    [loadPipeliners, supabase],
  );

  const handlePromotePipeliner = useCallback(
    async (pipeliner: PipelinerEligibility) => {
      if (!pipeliner.email) {
        toast.error("An email address is required before promotion.");
        return;
      }

      setPromotingPipelinerId(pipeliner.id);
      try {
        const joinDate = format(new Date(), "yyyy-MM-dd");

        const { error: memberError } = await supabase.from("members").insert({
          full_name: pipeliner.full_name,
          email: pipeliner.email,
          phone: pipeliner.phone,
          join_date: joinDate,
          status: "pending",
          member_number: null,
        });

        if (memberError) {
          throw memberError;
        }

        const { error: pipelinerUpdateError } = await supabase
          .from("pipeliners")
          .update({
            status: "promoted",
            promoted_from_guest_date: new Date().toISOString(),
          })
          .eq("id", pipeliner.id);

        if (pipelinerUpdateError) {
          throw pipelinerUpdateError;
        }

        toast.success(`${pipeliner.full_name} promoted to member.`);
        await loadPipeliners({ silently: true });
      } catch (error) {
        console.error("Failed to promote pipeliner", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to promote to member right now.",
        );
      } finally {
        setPromotingPipelinerId(null);
      }
    },
    [loadPipeliners, supabase],
  );

  const saveAttendance = useCallback(
    async (options?: { auto?: boolean }) => {
      if (!selectedMeetingId || saving) return;

      const memberUpserts: AttendanceUpsertInput[] = [];
      const guestUpserts: AttendanceUpsertInput[] = [];
      const pipelinerUpserts: AttendanceUpsertInput[] = [];
      const deletions: string[] = [];

      const memberNames: string[] = [];
      const guestNames: string[] = [];
      const pipelinerNames: string[] = [];

      for (const member of members) {
        const current =
          memberAttendance[member.id] ??
          ({ attendanceId: null, status: null } satisfies MemberAttendanceEntry);
        const initial =
          memberInitialRef.current[member.id] ??
          ({ attendanceId: null, status: null } satisfies MemberAttendanceEntry);

        const currentStatus = current.status ?? null;
        const initialStatus = initial.status ?? null;

        if (currentStatus === initialStatus) continue;

        const attendanceId = current.attendanceId ?? initial.attendanceId ?? null;

        if (currentStatus) {
          memberUpserts.push({
            id: attendanceId,
            meeting_id: selectedMeetingId,
            member_id: member.id,
            status: currentStatus,
          });
        } else if (initial.attendanceId) {
          deletions.push(initial.attendanceId);
        }

        memberNames.push(member.full_name);
      }

      for (const guest of guests) {
        const current =
          guestAttendance[guest.id] ??
          ({ attendanceId: null, attended: false } satisfies GuestAttendanceEntry);
        const initial =
          guestInitialRef.current[guest.id] ??
          ({ attendanceId: null, attended: false } satisfies GuestAttendanceEntry);

        if (current.attended === initial.attended) continue;

        const attendanceId = current.attendanceId ?? initial.attendanceId ?? null;

        if (current.attended) {
          guestUpserts.push({
            id: attendanceId,
            meeting_id: selectedMeetingId,
            guest_id: guest.id,
            status: "present",
          });
        } else if (initial.attendanceId) {
          deletions.push(initial.attendanceId);
        }

        guestNames.push(guest.full_name);
      }

      for (const pipeliner of pipelinerEligibility) {
        const current =
          pipelinerAttendance[pipeliner.id] ??
          ({
            attendanceId: null,
            attended: false,
          } satisfies PipelinerAttendanceEntry);
        const initial =
          pipelinerInitialRef.current[pipeliner.id] ??
          ({
            attendanceId: null,
            attended: false,
          } satisfies PipelinerAttendanceEntry);

        if (current.attended === initial.attended) continue;

        const attendanceId = current.attendanceId ?? initial.attendanceId ?? null;

        if (current.attended) {
          pipelinerUpserts.push({
            id: attendanceId,
            meeting_id: selectedMeetingId,
            pipeliner_id: pipeliner.id,
            status: "present",
          });
        } else if (initial.attendanceId) {
          deletions.push(initial.attendanceId);
        }

        pipelinerNames.push(pipeliner.full_name);
      }

      const upserts = [
        ...memberUpserts,
        ...guestUpserts,
        ...pipelinerUpserts,
      ];

      if (upserts.length === 0 && deletions.length === 0) {
        if (!options?.auto) {
          toast.info("No attendance changes to save.");
        }
        return;
      }

      const summaryBeforeSave = computeSummary(
        memberAttendance,
        guestAttendance,
        pipelinerAttendance,
      );

      setSaving(true);
      setSaveError(null);
      setErrorRecords([]);
      setAutoSaveScheduled(false);

      try {
        const response = await fetch("/api/attendance/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId: selectedMeetingId,
            meetingType: selectedMeeting?.meeting_type ?? null,
            upserts,
            deletions,
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(
            errorPayload?.error ?? "Failed to save attendance records.",
          );
        }

        const result = (await response.json()) as SaveAttendanceResponse;

        if (!result.success) {
          throw new Error(result.error ?? "Attendance save failed.");
        }

        const deletionSet = new Set(result.deletedIds);

        setMemberAttendance((prev) => {
          const next: Record<string, MemberAttendanceEntry> = {};
          for (const member of members) {
            const existing =
              prev[member.id] ??
              memberInitialRef.current[member.id] ?? {
                attendanceId: null,
                status: null,
              };
            let attendanceId = existing.attendanceId;
            if (attendanceId && deletionSet.has(attendanceId)) {
              attendanceId = null;
            }
            next[member.id] = {
              attendanceId,
              status: existing.status,
            };
          }

          for (const record of result.records) {
            if (record.member_id) {
              next[record.member_id] = {
                attendanceId: record.id,
                status: record.status,
              };
            }
          }

          memberInitialRef.current = snapshotMemberAttendance(next);
          return next;
        });

        setGuestAttendance((prev) => {
          const next: Record<string, GuestAttendanceEntry> = {};
          for (const guest of guests) {
            const existing =
              prev[guest.id] ??
              guestInitialRef.current[guest.id] ?? {
                attendanceId: null,
                attended: false,
              };
            let attendanceId = existing.attendanceId;
            if (attendanceId && deletionSet.has(attendanceId)) {
              attendanceId = null;
            }
            next[guest.id] = {
              attendanceId,
              attended: existing.attended,
            };
          }

          for (const record of result.records) {
            if (record.guest_id) {
              next[record.guest_id] = {
                attendanceId: record.id,
                attended: record.status === "present",
              };
            }
          }

          guestInitialRef.current = snapshotGuestAttendance(next);
          return next;
        });

        setPipelinerAttendance((prev) => {
          const next: Record<string, PipelinerAttendanceEntry> = {};
          for (const pipeliner of pipelinerEligibility) {
            const existing =
              prev[pipeliner.id] ??
              pipelinerInitialRef.current[pipeliner.id] ?? {
                attendanceId: null,
                attended: false,
              };
            let attendanceId = existing.attendanceId;
            if (attendanceId && deletionSet.has(attendanceId)) {
              attendanceId = null;
            }
            next[pipeliner.id] = {
              attendanceId,
              attended: existing.attended,
            };
          }

          for (const record of result.records) {
            if (record.pipeliner_id) {
              next[record.pipeliner_id] = {
                attendanceId: record.id,
                attended: record.status === "present",
              };
            }
          }

          pipelinerInitialRef.current = snapshotPipelinerAttendance(next);
          return next;
        });

        setLastSavedAt(new Date());
        await Promise.all([
          loadGuests({ silently: true }),
          loadPipeliners({ silently: true }),
        ]);

        if (!options?.auto) {
          toast.success(
            `Recorded: ${summaryBeforeSave.present} present, ${summaryBeforeSave.apology} apologies, ${summaryBeforeSave.absent} absent`,
          );
        }
      } catch (error) {
        console.error("Failed to batch save attendance", error);
        const impacted = [
          ...memberNames,
          ...guestNames,
          ...pipelinerNames,
        ];
        setSaveError(
          error instanceof Error
            ? error.message
            : "Unable to save attendance changes.",
        );
        setErrorRecords(impacted);
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to save attendance changes.",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      guestAttendance,
      guests,
      loadGuests,
      loadPipeliners,
      memberAttendance,
      members,
      pipelinerAttendance,
      pipelinerEligibility,
      saving,
      selectedMeeting?.meeting_type,
      selectedMeetingId,
      supabase,
    ],
  );

  useEffect(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    if (!selectedMeetingId || !hasUnsavedChanges || saving) {
      setAutoSaveScheduled(false);
      return;
    }

    setAutoSaveScheduled(true);
    autoSaveTimer.current = setTimeout(() => {
      setAutoSaveScheduled(false);
      void saveAttendance({ auto: true });
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, [selectedMeetingId, hasUnsavedChanges, saving, saveAttendance]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  const showGlobalLoading =
    meetingsLoading || membersLoading || attendanceLoading;

  const lastSavedLabel = lastSavedAt
    ? formatDistanceToNow(lastSavedAt, { addSuffix: true })
    : null;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="page-shell section-stack">
        <header className="flex flex-col gap-responsive md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
              <UsersIcon className="size-7 text-primary" />
              Meeting Attendance
            </h1>
            <p className="text-sm text-muted-foreground">
              Select a meeting, mark member responses, and keep guests on the path to membership.
            </p>
          </div>
          {selectedMeeting && (
            <Badge
              className={cn(
                "gap-2 rounded-full px-4 py-2 text-sm",
                meetingTypeStyles[
                  selectedMeeting.meeting_type as keyof typeof meetingTypeStyles
                ]?.badge ?? meetingTypeStyles.business.badge,
              )}
            >
              {getMeetingTypeLabel(
                selectedMeeting.meeting_type as keyof typeof meetingTypeStyles,
              )}
            </Badge>
          )}
        </header>

        <section className="section-card section-stack">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meeting
              </label>
              <Select
                value={selectedMeetingId}
                onValueChange={(value) => setSelectedMeetingId(value)}
                disabled={meetingsLoading || meetings.length === 0}
              >
                <SelectTrigger className="w-full min-w-0 sm:w-72">
                  <SelectValue placeholder="Select a meeting" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {meetingOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.secondary}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 sm:w-auto sm:justify-start">
                {attendanceLoading ? (
                  <Loader2Icon className="size-4 animate-spin text-primary" />
                ) : (
                  <UserCheckIcon className="size-4 text-primary" />
                )}
                <span>
                  {membersPresent}/{totalMembers} members present
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                onClick={handleMarkAllPresent}
                disabled={
                  !selectedMeetingId || members.length === 0 || saving
                }
              >
                <CheckIcon className="size-4" />
                Mark All Present
              </Button>
            </div>
          </div>

          {selectedMeeting && (
            <div className="flex flex-col gap-4 rounded-xl bg-slate-50/60 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <CalendarDaysIcon className="size-4 text-primary" />
                  {format(parseISO(selectedMeeting.meeting_date), "EEEE, d MMM yyyy")}
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-4 text-primary" />
                  {selectedMeeting.location ?? "Venue to be confirmed"}
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary">
                Keep attendance live so the leadership team can sync reports instantly.
              </div>
            </div>
          )}

          {(meetingsError || membersError) && (
            <p className="rounded-lg border border-dashed border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {meetingsError ?? membersError}
            </p>
          )}
        </section>

        <section className="section-card section-stack">
          <header className="flex flex-col gap-responsive sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Members</h2>
              <p className="text-sm text-muted-foreground">
                Tap a status to record attendance. Clicking the current status clears it.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 self-start sm:w-auto sm:self-auto"
              onClick={() =>
                setMemberViewMode((current) =>
                  current === "grid" ? "list" : "grid",
                )
              }
              aria-pressed={isListView}
              disabled={showGlobalLoading || totalMembers === 0}
            >
              {isListView ? (
                <LayoutGridIcon className="size-4" />
              ) : (
                <ListIcon className="size-4" />
              )}
              {isListView ? "Card view" : "List view"}
            </Button>
          </header>

          {attendanceError && (
            <p className="mt-4 rounded-lg border border-dashed border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {attendanceError}
            </p>
          )}

          {showGlobalLoading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2Icon className="mr-2 size-5 animate-spin" />
              Loading attendance workspace…
            </div>
          ) : totalMembers === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-muted bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
              No members found. Add members first to start capturing attendance.
            </div>
          ) : isListView ? (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <Table className="min-w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40 whitespace-nowrap">Member</TableHead>
                    <TableHead className="hidden whitespace-nowrap text-center sm:table-cell">
                      Attendance
                    </TableHead>
                    <TableHead className="w-48 whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
          {membersAlphabetical.map((member) => {
                    const status = memberAttendance[member.id]?.status ?? null;
                    const initialStatus =
                      memberInitialRef.current[member.id]?.status ?? null;
                    const dirty = status !== initialStatus;
                    const attendancePercent = member.total_meetings
                      ? Math.round(
                          (member.present_count / member.total_meetings) * 100,
                        )
                      : 0;

                    return (
                      <TableRow
                        key={member.id}
                        className={cn(
                          "align-top transition-colors hover:bg-slate-50",
                          dirty && "bg-primary/5",
                        )}
                      >
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {member.full_name}
                              </span>
                              {dirty && (
                                <Badge
                                  variant="outline"
                                  className="border-primary/40 bg-primary/10 text-[10px] font-semibold uppercase tracking-wide text-primary"
                                >
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Attendance {attendancePercent}%
                              {member.member_number
                                ? ` · #${member.member_number}`
                                : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden align-middle text-center text-sm font-semibold text-slate-900 sm:table-cell">
                          {attendancePercent}%
                        </TableCell>
                        <TableCell className="align-top">
                          <MemberStatusButtons
                            status={status}
                            disabled={!selectedMeetingId || saving}
                            onChange={(next) =>
                              handleMemberStatusChange(member.id, next)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 grid gap-responsive sm:grid-cols-2 xl:grid-cols-3">
              {membersAlphabetical.map((member) => {
                const status = memberAttendance[member.id]?.status ?? null;
                const initialStatus =
                  memberInitialRef.current[member.id]?.status ?? null;
                const dirty = status !== initialStatus;
                return (
                  <MemberAttendanceCard
                    key={member.id}
                    member={member}
                    status={status}
                    dirty={dirty}
                    disabled={!selectedMeetingId || saving}
                    onStatusChange={(next) =>
                      handleMemberStatusChange(member.id, next)
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="section-card section-stack">
          <header className="flex flex-col gap-responsive sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Guests</h2>
              <p className="text-sm text-muted-foreground">
                Track recurring visitors, mark who attended, and fast-track promotions.
              </p>
            </div>
          </header>

          <QuickAddGuestForm onSubmit={handleAddGuest} loading={creatingGuest} />

          {guestError && (
            <p className="mt-4 rounded-lg border border-dashed border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {guestError}
            </p>
          )}

          {guestLoading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2Icon className="mr-2 size-5 animate-spin" />
              Loading guests…
            </div>
          ) : guests.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-muted bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
              No guests recorded yet. Add guests as they arrive and mark their attendance.
            </div>
          ) : (
            <div className="mt-6 grid gap-responsive md:grid-cols-2">
              {guests.map((guest) => {
                const attended = guestAttendance[guest.id]?.attended ?? false;
                const eligible =
                  guest.eligible_for_pipeliner || guest.meeting_count >= 3;
                return (
                  <GuestAttendanceItem
                    key={guest.id}
                    guest={guest}
                    attended={attended}
                    eligible={eligible}
                    disabled={!selectedMeetingId || saving}
                    promoting={promotingGuestId === guest.id}
                    onToggle={(checked) => handleGuestToggle(guest.id, checked)}
                    onPromote={() => handlePromoteGuest(guest)}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="section-card section-stack">
          <header className="flex flex-col gap-responsive sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Pipeliners</h2>
              <p className="text-sm text-muted-foreground">
                Track qualifying attendance and fast-track promotions to member status.
              </p>
            </div>
          </header>

          {pipelinerError && (
            <p className="mt-4 rounded-lg border border-dashed border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {pipelinerError}
            </p>
          )}

          {pipelinerLoading && pipelinerEligibility.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <Loader2Icon className="mr-2 size-5 animate-spin" />
              Loading pipeliners…
            </div>
          ) : pipelinerEligibility.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-muted bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
              No pipeliners captured yet. Promote eligible guests to start tracking.
            </div>
          ) : (
            <div className="mt-6 grid gap-responsive md:grid-cols-2">
              {pipelinerEligibility.map((pipeliner) => {
                const attended = pipelinerAttendance[pipeliner.id]?.attended ?? false;
                return (
                  <PipelinerAttendanceItem
                    key={pipeliner.id}
                    pipeliner={pipeliner}
                    attended={attended}
                    disabled={!selectedMeetingId || saving}
                    promoting={promotingPipelinerId === pipeliner.id}
                    onToggle={(checked) => handlePipelinerToggle(pipeliner.id, checked)}
                    onPromote={() => handlePromotePipeliner(pipeliner)}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="sticky bottom-[calc(env(safe-area-inset-bottom)+6rem)] mt-4 lg:bottom-8">
          <div className="section-card section-stack bg-white/90 shadow-2xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  Present {currentSummary.present}
                </Badge>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  Apologies {currentSummary.apology}
                </Badge>
                <Badge variant="secondary" className="bg-rose-100 text-rose-700">
                  Absent {currentSummary.absent}
                </Badge>
              </div>
              <Button
                type="button"
                className="w-full gap-2 sm:w-auto"
                onClick={() => void saveAttendance()}
                disabled={
                  !selectedMeetingId || !hasUnsavedChanges || saving
                }
              >
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <CheckIcon className="size-4" />
                )}
                Save Attendance
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {saveError ? (
                <span className="text-destructive">Save failed: {saveError}</span>
              ) : hasUnsavedChanges ? (
                autoSaveScheduled
                  ? "Unsaved changes · auto-saving shortly…"
                  : "Unsaved changes ready to save."
              ) : lastSavedLabel ? (
                `Last saved ${lastSavedLabel}`
              ) : (
                "No attendance recorded yet."
              )}
            </div>
            {errorRecords.length > 0 && (
              <p className="break-words text-xs text-destructive/80">
                Issue affecting: {errorRecords.join(", ")}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
