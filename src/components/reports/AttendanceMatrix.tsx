"use client";

import { format, isValid, parseISO } from "date-fns";
import { PrinterIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { ReportsAttendanceRecord } from "@/hooks/useReportsData";
import type { MemberAttendanceSummary, Meeting } from "@/types/database";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortOption = "name-asc" | "attendance-desc";

type AttendanceMatrixProps = {
  members: MemberAttendanceSummary[];
  meetings: Meeting[];
  attendance: ReportsAttendanceRecord[];
  sortOption: SortOption;
  onSortChange: (value: SortOption) => void;
};

const STATUS_SYMBOLS: Record<
  ReportsAttendanceRecord["status"],
  { symbol: string; label: string; className: string }
> = {
  present: {
    symbol: "✓",
    label: "Present",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  apology: {
    symbol: "A",
    label: "Apology",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  absent: {
    symbol: "X",
    label: "Absent",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function formatDateLabel(value: string | null | undefined, fallback = "—") {
  const parsed = parseDate(value);
  if (!parsed) return fallback;
  return format(parsed, "dd MMM yyyy");
}

function getRowTone(percentage: number) {
  if (percentage >= 80) return "bg-emerald-50";
  if (percentage >= 60) return "bg-blue-50";
  if (percentage >= 40) return "bg-amber-50/60";
  return "bg-rose-50/70";
}

export function AttendanceMatrix({
  members,
  meetings,
  attendance,
  sortOption,
  onSortChange,
}: AttendanceMatrixProps) {
  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  }, [meetings]);

  const attendanceByMember = useMemo(() => {
    const map = new Map<string, Map<string, ReportsAttendanceRecord>>();
    attendance.forEach((record) => {
      const memberRecords = map.get(record.memberId) ?? new Map<string, ReportsAttendanceRecord>();
      memberRecords.set(record.meetingId, record);
      map.set(record.memberId, memberRecords);
    });
    return map;
  }, [attendance]);

  const sortedMembers = useMemo(() => {
    const enhanced = members.map((member) => {
      const totalMeetings = member.total_meetings ?? 0;
      const present = member.present_count ?? 0;
      const percentage = totalMeetings === 0 ? 0 : Math.round((present / totalMeetings) * 100);
      return {
        ...member,
        attendancePercentage: percentage,
      };
    });

    if (sortOption === "name-asc") {
      return enhanced.sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    return enhanced.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
  }, [members, sortOption]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print-transparent">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Attendance Matrix</h2>
            <p className="text-xs text-muted-foreground">
              Track attendance for every member across meetings. Rows are colour-coded based on overall attendance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortOption}
              onChange={(event) => onSortChange(event.target.value as SortOption)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="attendance-desc">Attendance %</option>
              <option value="name-asc">Name (A-Z)</option>
            </select>
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <PrinterIcon className="size-4" />
              Print-friendly view
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="flex size-4 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
              ✓
            </span>
            Present
          </div>
          <div className="flex items-center gap-1">
            <span className="flex size-4 items-center justify-center rounded border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-700">
              A
            </span>
            Apology
          </div>
          <div className="flex items-center gap-1">
            <span className="flex size-4 items-center justify-center rounded border border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-700">
              X
            </span>
            Absent
          </div>
          <div className="flex items-center gap-1">
            <span className="flex size-4 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
              -
            </span>
            Not a member yet
          </div>
        </div>
        <div className="print-show hidden text-center text-sm font-semibold text-slate-900">
          Attendance Matrix Export · Generated {format(new Date(), "dd MMM yyyy")}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm print-table">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-white shadow-sm print-transparent">
            <TableRow>
              <TableHead className="sticky left-0 z-30 w-48 bg-white text-left shadow-sm print-transparent">
                Member
              </TableHead>
              {sortedMeetings.map((meeting) => (
                <TableHead
                  key={meeting.id}
                  className="report-col bg-white text-center text-xs font-semibold text-muted-foreground print-transparent"
                >
                  <div className="flex flex-col gap-1">
                    <span>{formatDateLabel(meeting.meeting_date)}</span>
                    <span className="font-normal capitalize text-slate-400">
                      {meeting.meeting_type ?? "business"}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-30 report-col bg-white text-center shadow-sm print-transparent">
                Attendance %
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((member) => {
              const joinDate = parseDate(member.join_date);
              const memberRecords = attendanceByMember.get(member.id);
              const rowTone = getRowTone(member.attendancePercentage);

              return (
                <TableRow key={member.id} className={cn("border-b", rowTone)}>
                  <TableCell className="sticky left-0 z-20 bg-inherit font-medium text-slate-900 shadow-sm">
                    <div className="flex flex-col">
                      <span>{member.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatDateLabel(member.join_date)}
                      </span>
                    </div>
                  </TableCell>
                  {sortedMeetings.map((meeting) => {
                    const meetingDate = parseDate(meeting.meeting_date);
                    if (!meetingDate || !joinDate) {
                      return (
                        <TableCell key={meeting.id} className="bg-white/80 text-center text-xs">
                          —
                        </TableCell>
                      );
                    }

                    if (meetingDate < joinDate) {
                      return (
                        <TableCell key={meeting.id} className="text-center">
                          <span className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                            -
                          </span>
                        </TableCell>
                      );
                    }

                    const record = memberRecords?.get(meeting.id);
                    if (!record) {
                      return (
                        <TableCell key={meeting.id} className="text-center">
                          <span className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700">
                            X
                          </span>
                        </TableCell>
                      );
                    }

                    const symbol = STATUS_SYMBOLS[record.status];
                    return (
                      <TableCell key={meeting.id} className="text-center">
                        <span
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-lg border text-xs font-semibold",
                            symbol?.className,
                          )}
                          title={symbol?.label}
                        >
                          {symbol?.symbol ?? "—"}
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell className="sticky right-0 z-20 bg-inherit text-center font-semibold text-slate-900 shadow-sm">
                    {member.attendancePercentage}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export type { SortOption as AttendanceMatrixSortOption };


