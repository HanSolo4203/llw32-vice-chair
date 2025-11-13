"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  AlertTriangleIcon,
  BarChart3Icon,
  CalendarCheckIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LineChartIcon,
  PrinterIcon,
  RefreshCcwIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useReportsData } from "@/hooks/useReportsData";
import type { ReportsAttendanceRecord } from "@/hooks/useReportsData";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemberAttendanceSummary } from "@/types/database";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SortOption = "name-asc" | "attendance-desc";

type ExportKey =
  | "combinedPdf"
  | "attendanceWorkbook"
  | "memberCsv"
  | "guestCsv"
  | "pipelinerCsv"
  | "meetingPdf"
  | "yearEndPdf";

type MemberWithStats = MemberAttendanceSummary & {
  attendancePercentage: number;
  apologies: number;
  absences: number;
};

type MonthTrendPoint = {
  key: string;
  month: string;
  present: number;
  apologies: number;
  absences: number;
  attendancePercentage: number;
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

const MEETING_TYPE_COLORS: Record<string, string> = {
  business: "#2563eb",
  charity: "#16a34a",
  special: "#e11d48",
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MAX_MEMBER_OVERLAY = 5;

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return parsed;
}

function getRowTone(percentage: number) {
  if (percentage >= 80) return "bg-emerald-50";
  if (percentage >= 60) return "bg-blue-50";
  if (percentage >= 40) return "bg-amber-50/60";
  return "bg-rose-50/70";
}

function formatDateLabel(value: string | null | undefined, fallback = "—") {
  const parsed = parseDate(value);
  if (!parsed) return fallback;
  return format(parsed, "dd MMM yyyy");
}

const COLOR_FALLBACKS: Record<string, string> = {
  "--background": "#ffffff",
  "--foreground": "#0f172a",
  "--card": "#ffffff",
  "--card-foreground": "#0f172a",
  "--popover": "#ffffff",
  "--popover-foreground": "#0f172a",
  "--primary": "#ea580c",
  "--primary-foreground": "#ffffff",
  "--secondary": "#f8fafc",
  "--secondary-foreground": "#0f172a",
  "--muted": "#f8fafc",
  "--muted-foreground": "#64748b",
  "--accent": "#f8fafc",
  "--accent-foreground": "#0f172a",
  "--destructive": "#ef4444",
  "--border": "#e2e8f0",
  "--input": "#e2e8f0",
  "--ring": "#38bdf8",
  "--chart-1": "#0f172a",
  "--chart-2": "#1d4ed8",
  "--chart-3": "#38bdf8",
  "--chart-4": "#f59e0b",
  "--chart-5": "#22c55e",
  "--sidebar": "#ffffff",
  "--sidebar-foreground": "#0f172a",
  "--sidebar-primary": "#1d4ed8",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-accent": "#f8fafc",
  "--sidebar-accent-foreground": "#0f172a",
  "--sidebar-border": "#e2e8f0",
  "--sidebar-ring": "#38bdf8",
};

function applyColorFallbacks() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const root = document.documentElement;
  const previous = new Map<string, string>();

  Object.entries(COLOR_FALLBACKS).forEach(([variable, fallback]) => {
    previous.set(variable, root.style.getPropertyValue(variable));
    root.style.setProperty(variable, fallback);
  });

  return () => {
    previous.forEach((value, variable) => {
      if (value && value.trim().length > 0) {
        root.style.setProperty(variable, value);
      } else {
        root.style.removeProperty(variable);
      }
    });
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ReportsPage() {
  const { members, meetings, attendance, guests, pipeliners, loading, error, refresh } =
    useReportsData();
  const [activeTab, setActiveTab] = useState<"overview" | "matrix" | "trends" | "export">(
    "overview",
  );
  const [sortOption, setSortOption] = useState<SortOption>("attendance-desc");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [exportingKey, setExportingKey] = useState<ExportKey | null>(null);
  const [lastExportTimes, setLastExportTimes] = useState<Record<ExportKey, Date | null>>({
    combinedPdf: null,
    attendanceWorkbook: null,
    memberCsv: null,
    guestCsv: null,
    pipelinerCsv: null,
    meetingPdf: null,
    yearEndPdf: null,
  });

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) => member.status === "active" && member.member_number !== null,
      ),
    [members],
  );

  const memberStats = useMemo<MemberWithStats[]>(() => {
    return activeMembers.map((member) => {
      const totalMeetings = member.total_meetings ?? 0;
      const presentCount = member.present_count ?? 0;
      const apologyCount = member.apology_count ?? 0;
      const absentCount = member.absent_count ?? 0;
      const attendancePercentage =
        totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0;

      return {
        ...member,
        attendancePercentage,
        apologies: apologyCount,
        absences: absentCount,
      };
    });
  }, [activeMembers]);

  const meetingsSorted = useMemo(() => {
    return [...meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  }, [meetings]);

  const attendanceByMeeting = useMemo(() => {
    const map = new Map<string, ReportsAttendanceRecord[]>();
    attendance.forEach((record) => {
      const records = map.get(record.meetingId) ?? [];
      records.push(record);
      map.set(record.meetingId, records);
    });
    return map;
  }, [attendance]);

  const attendanceByMember = useMemo(() => {
    const map = new Map<string, Map<string, ReportsAttendanceRecord>>();
    attendance.forEach((record) => {
      const memberRecords = map.get(record.memberId) ?? new Map<string, ReportsAttendanceRecord>();
      memberRecords.set(record.meetingId, record);
      map.set(record.memberId, memberRecords);
    });
    return map;
  }, [attendance]);

  const totalMeetingsHeld = meetings.length;

  const averageAttendance = useMemo(() => {
    if (memberStats.length === 0) return 0;
    const withMeetings = memberStats.filter((member) => member.total_meetings > 0);
    if (withMeetings.length === 0) return 0;
    const sum = withMeetings.reduce((acc, member) => acc + member.attendancePercentage, 0);
    return Math.round(sum / withMeetings.length);
  }, [memberStats]);

  const bestPerformer = useMemo(() => {
    return [...memberStats]
      .filter((member) => member.total_meetings > 0)
      .sort((a, b) => b.attendancePercentage - a.attendancePercentage)[0];
  }, [memberStats]);

  const membersAtRisk = useMemo(() => {
    return memberStats.filter(
      (member) => member.total_meetings > 0 && member.attendancePercentage < 60,
    ).length;
  }, [memberStats]);

  const topPerformers = useMemo(() => {
    return [...memberStats]
      .filter((member) => member.total_meetings > 0)
      .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
      .slice(0, 5);
  }, [memberStats]);

  const bottomPerformers = useMemo(() => {
    return [...memberStats]
      .filter((member) => member.total_meetings > 0)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
      .slice(0, 5);
  }, [memberStats]);

  const monthTrend = useMemo<MonthTrendPoint[]>(() => {
    const monthMap = new Map<
      string,
      { date: Date; present: number; apologies: number; absences: number; total: number }
    >();

    attendance.forEach((record) => {
      const dateString = record.meetingDate ?? meetings.find((m) => m.id === record.meetingId)?.meeting_date;
      const parsed = parseDate(dateString);
      if (!parsed) return;
      const key = format(parsed, "yyyy-MM");
      const entry =
        monthMap.get(key) ??
        {
          date: parsed,
          present: 0,
          apologies: 0,
          absences: 0,
          total: 0,
        };

      entry.total += 1;
      if (record.status === "present") {
        entry.present += 1;
      } else if (record.status === "apology") {
        entry.apologies += 1;
      } else if (record.status === "absent") {
        entry.absences += 1;
      }

      monthMap.set(key, entry);
    });

    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, entry]) => {
        const attendanceScore =
          entry.total === 0
            ? 0
            : Math.round(((entry.present + 0.5 * entry.apologies) / entry.total) * 100);

        return {
          key,
          month: format(entry.date, "MMM yyyy"),
          present: entry.present,
          apologies: entry.apologies,
          absences: entry.absences,
          attendancePercentage: attendanceScore,
        };
      });
  }, [attendance, meetings]);

  const memberMonthlyTrend = useMemo(() => {
    const map = new Map<string, Map<string, { label: string; score: number; total: number }>>();
    attendance.forEach((record) => {
      const dateString = record.meetingDate ?? meetings.find((m) => m.id === record.meetingId)?.meeting_date;
      const parsed = parseDate(dateString);
      if (!parsed) return;
      const key = format(parsed, "yyyy-MM");
      const label = format(parsed, "MMM yyyy");

      const memberMap = map.get(record.memberId) ?? new Map();
      const entry =
        memberMap.get(key) ?? {
          label,
          score: 0,
          total: 0,
        };

      entry.total += 1;
      if (record.status === "present") {
        entry.score += 1;
      } else if (record.status === "apology") {
        entry.score += 0.5;
      }

      memberMap.set(key, entry);
      map.set(record.memberId, memberMap);
    });

    const trendData = new Map<string, { month: string; percentage: number }[]>();
    map.forEach((monthMap, memberId) => {
      const data = [...monthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, entry]) => ({
          month: entry.label,
          percentage: entry.total === 0 ? 0 : Math.round((entry.score / entry.total) * 100),
        }));
      trendData.set(memberId, data);
    });

    return trendData;
  }, [attendance, meetings]);

  const meetingTypeCounts = useMemo(() => {
    return meetings.reduce<Record<string, number>>((acc, meeting) => {
      const type = meeting.meeting_type ?? "business";
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});
  }, [meetings]);

  const attendanceByDay = useMemo(() => {
    const dayMap = new Map<
      string,
      { label: string; score: number; total: number; present: number; apologies: number }
    >();

    attendance.forEach((record) => {
      const dateString = record.meetingDate ?? meetings.find((m) => m.id === record.meetingId)?.meeting_date;
      const parsed = parseDate(dateString);
      if (!parsed) return;
      const day = format(parsed, "EEEE");
      const entry =
        dayMap.get(day) ?? {
          label: day,
          score: 0,
          total: 0,
          present: 0,
          apologies: 0,
        };

      entry.total += 1;
      if (record.status === "present") {
        entry.present += 1;
        entry.score += 1;
      } else if (record.status === "apology") {
        entry.apologies += 1;
        entry.score += 0.5;
      }

      dayMap.set(day, entry);
    });

    return DAY_ORDER.filter((day) => dayMap.has(day)).map((day) => {
      const entry = dayMap.get(day)!;
      return {
        day: entry.label,
        present: entry.present,
        apologies: entry.apologies,
        attendancePercentage: entry.total === 0 ? 0 : Math.round((entry.score / entry.total) * 100),
      };
    });
  }, [attendance, meetings]);

  const sortedMembersForMatrix = useMemo(() => {
    const copied = [...memberStats];
    if (sortOption === "name-asc") {
      copied.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else {
      copied.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    }
    return copied;
  }, [memberStats, sortOption]);

  const lineChartData = useMemo(() => {
    return monthTrend.map((monthEntry) => {
      const point: Record<string, number | string | null> = {
        month: monthEntry.month,
        overall: monthEntry.attendancePercentage,
      };

      selectedMemberIds.forEach((memberId) => {
        const trend = memberMonthlyTrend.get(memberId);
        if (!trend) {
          point[memberId] = null;
          return;
        }
        const match = trend.find((entry) => entry.month === monthEntry.month);
        point[memberId] = match ? match.percentage : null;
      });

      return point;
    });
  }, [memberMonthlyTrend, monthTrend, selectedMemberIds]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast.success("Reports refreshed");
    } catch (refreshError) {
      console.error(refreshError);
      toast.error("Unable to refresh reports right now.");
    }
  }, [refresh]);

  const toggleMemberSelection = useCallback(
    (memberId: string) => {
      setSelectedMemberIds((current) => {
        if (current.includes(memberId)) {
          return current.filter((id) => id !== memberId);
        }
        if (current.length >= MAX_MEMBER_OVERLAY) {
          toast.error(`You can overlay up to ${MAX_MEMBER_OVERLAY} members at a time.`);
          return current;
        }
        return [...current, memberId];
      });
    },
    [],
  );

  const updateExportTimestamp = useCallback((key: ExportKey) => {
    setLastExportTimes((previous) => ({
      ...previous,
      [key]: new Date(),
    }));
  }, []);

  const exportCombinedPdf = useCallback(async () => {
    setExportingKey("combinedPdf");
    let container: HTMLDivElement | null = null;
    let restoreColors: (() => void) | null = null;
    try {
      restoreColors = applyColorFallbacks();
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const numberFormatter = new Intl.NumberFormat("en-GB");
      const timestamp = format(new Date(), "dd MMM yyyy HH:mm");
      const eligibleGuests = guests.filter((guest) => guest.eligible_for_pipeliner).length;
      const eligiblePipeliners = pipeliners.filter((pipeliner) => pipeliner.meets_requirements).length;
      const topAttendanceMembers = [...memberStats]
        .filter((member) => member.total_meetings > 0)
        .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
        .slice(0, 8);
      const atRiskMembersList = memberStats
        .filter((member) => member.total_meetings > 0 && member.attendancePercentage < 60)
        .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
        .slice(0, 8);
      const recentMeetings = [...meetingsSorted].slice(-8).reverse();
      const leadingGuests = [...guests]
        .sort((a, b) => (b.meeting_count ?? 0) - (a.meeting_count ?? 0))
        .slice(0, 8);
      const leadingPipeliners = [...pipeliners]
        .sort((a, b) => (b.meeting_count ?? 0) - (a.meeting_count ?? 0))
        .slice(0, 8);

      const metricsHtml = [
        { label: "Active members", value: numberFormatter.format(activeMembers.length) },
        { label: "Average attendance", value: `${averageAttendance}%` },
        { label: "Meetings held", value: numberFormatter.format(totalMeetingsHeld) },
        { label: "Guests tracked", value: numberFormatter.format(guests.length) },
        {
          label: "Eligible guests",
          value: `${numberFormatter.format(eligibleGuests)} of ${numberFormatter.format(guests.length)}`,
        },
        {
          label: "Eligible pipeliners",
          value: `${numberFormatter.format(eligiblePipeliners)} of ${numberFormatter.format(pipeliners.length)}`,
        },
        { label: "Members at risk (<60%)", value: numberFormatter.format(membersAtRisk) },
        {
          label: "Best performer",
          value: bestPerformer
            ? `${bestPerformer.full_name} - ${bestPerformer.attendancePercentage}%`
            : "Pending",
        },
      ]
        .map(
          (metric) => `
            <div class="metric">
              <div class="metric-label">${escapeHtml(metric.label)}</div>
              <div class="metric-value">${escapeHtml(String(metric.value))}</div>
            </div>
          `,
        )
        .join("");

      const topMembersRows =
        topAttendanceMembers.length > 0
          ? topAttendanceMembers
              .map(
                (member, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(member.full_name)}</td>
                    <td>${member.total_meetings ?? 0}</td>
                    <td>${member.attendancePercentage}%</td>
                  </tr>
                `,
              )
              .join("")
          : `<tr class="empty-row"><td colspan="4">Attendance data not available yet.</td></tr>`;

      const atRiskRows =
        atRiskMembersList.length > 0
          ? atRiskMembersList
              .map(
                (member) => `
                  <tr>
                    <td>${escapeHtml(member.full_name)}</td>
                    <td>${member.total_meetings ?? 0}</td>
                    <td>${member.attendancePercentage}%</td>
                  </tr>
                `,
              )
              .join("")
          : `<tr class="empty-row"><td colspan="3">No members currently below 60% attendance.</td></tr>`;

      const meetingRows =
        recentMeetings.length > 0
          ? recentMeetings
              .map((meeting) => {
                const records = attendanceByMeeting.get(meeting.id) ?? [];
                const present = records.filter((record) => record.status === "present").length;
                const apologies = records.filter((record) => record.status === "apology").length;
                const total = records.length;
                const attendanceRate =
                  total === 0 ? 0 : Math.round(((present + 0.5 * apologies) / total) * 100);

                return `
                  <tr>
                    <td>${escapeHtml(formatDateLabel(meeting.meeting_date))}</td>
                    <td>${escapeHtml(meeting.meeting_type ?? "business")}</td>
                    <td>${escapeHtml(meeting.location ?? "On record")}</td>
                    <td>${total}</td>
                    <td>${present}</td>
                    <td>${apologies}</td>
                    <td>${attendanceRate}%</td>
                  </tr>
                `;
              })
              .join("")
          : `<tr class="empty-row"><td colspan="7">Meeting records will appear here once captured.</td></tr>`;

      const guestRows =
        leadingGuests.length > 0
          ? leadingGuests
              .map((guest) => `
                  <tr>
                    <td>${escapeHtml(guest.full_name)}</td>
                    <td>${guest.meeting_count ?? 0}</td>
                    <td>${escapeHtml(guest.invited_by ?? "Unknown")}</td>
                    <td>${guest.eligible_for_pipeliner ? "Yes" : "No"}</td>
                  </tr>
                `)
              .join("")
          : `<tr class="empty-row"><td colspan="4">Guest attendance data not available yet.</td></tr>`;

      const pipelinerRows =
        leadingPipeliners.length > 0
          ? leadingPipeliners
              .map((pipeliner) => `
                  <tr>
                    <td>${escapeHtml(pipeliner.full_name)}</td>
                    <td>${pipeliner.meeting_count ?? 0}</td>
                    <td>${pipeliner.charity_event_count ?? 0}</td>
                    <td>${pipeliner.meets_requirements ? "Ready" : "In progress"}</td>
                  </tr>
                `)
              .join("")
          : `<tr class="empty-row"><td colspan="4">Pipeliner data will appear once recorded.</td></tr>`;

      const combinedHtml = `
        <style>
          * { box-sizing: border-box; }
          .combined-report {
            font-family: "Calibri","Arial","Helvetica",sans-serif;
            color: #0f172a;
            width: 100%;
            background: #ffffff;
            padding: 48px 64px 64px;
          }
          .cover-header {
            display: flex;
            align-items: center;
            gap: 32px;
          }
          .cover-logo {
            width: 120px;
            height: 120px;
            object-fit: contain;
          }
          .cover-title h1 {
            margin: 0;
            font-size: 36px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #ea580c;
          }
          .cover-kicker {
            margin: 0;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.35em;
            color: #ea580c;
          }
          .cover-meta {
            margin: 8px 0 0;
            font-size: 12px;
            color: #64748b;
          }
          .cover-description {
            margin-top: 24px;
            font-size: 13px;
            line-height: 1.6;
            color: #1e293b;
          }
          .section {
            margin-top: 48px;
          }
          .section-title {
            margin: 0;
            font-size: 22px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #0f172a;
          }
          .section-subtitle {
            margin: 12px 0 0;
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.14em;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-top: 28px;
          }
          .metric {
            padding: 18px 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
          }
          .metric-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: #64748b;
          }
          .metric-value {
            margin-top: 6px;
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            padding: 10px 12px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            text-align: left;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
            color: #1e293b;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .empty-row td {
            color: #94a3b8;
            font-style: italic;
            text-align: center;
          }
          .note {
            margin-top: 12px;
            font-size: 11px;
            color: #64748b;
          }
          .footer {
            margin-top: 56px;
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            text-align: center;
          }
        </style>
        <div class="combined-report">
          <section class="cover">
            <div class="cover-header">
              <img src="/Hyena%20rondel%20white%20outline.png" alt="Round Table Lilongwe 32" class="cover-logo" />
              <div class="cover-title">
                <p class="cover-kicker">Round Table Lilongwe 32</p>
                <h1>Attendance Intelligence Pack</h1>
                <p class="cover-meta">Generated ${escapeHtml(timestamp)}</p>
              </div>
            </div>
            <p class="cover-description">
              Consolidated snapshot of all attendance exports including the workbook, member and guest directories, pipeliner insights, and PDF reports. Designed for rapid leadership review and sharing.
            </p>
          </section>

          <section class="section">
            <h2 class="section-title">Key Metrics At A Glance</h2>
            <p class="section-subtitle">Derived from the latest exports</p>
            <div class="metrics-grid">
              ${metricsHtml}
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">Top Attendance Performers</h2>
            <p class="section-subtitle">Source: Attendance workbook export</p>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member</th>
                  <th>Meetings</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                ${topMembersRows}
              </tbody>
            </table>
            <p class="note">Full roster is available in the workbook export.</p>
          </section>

          <section class="section">
            <h2 class="section-title">Members Requiring Follow-up</h2>
            <p class="section-subtitle">Source: Attendance matrix</p>
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Meetings</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                ${atRiskRows}
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2 class="section-title">Recent Meetings Snapshot</h2>
            <p class="section-subtitle">Source: Meeting summary PDF</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Total Records</th>
                  <th>Present</th>
                  <th>Apologies</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                ${meetingRows}
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2 class="section-title">Guest Pipeline Overview</h2>
            <p class="section-subtitle">Source: Guest list export</p>
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Meetings</th>
                  <th>Invited By</th>
                  <th>Eligible</th>
                </tr>
              </thead>
              <tbody>
                ${guestRows}
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2 class="section-title">Pipeliner Readiness</h2>
            <p class="section-subtitle">Source: Pipeliner list export</p>
            <table>
              <thead>
                <tr>
                  <th>Pipeliner</th>
                  <th>Meetings</th>
                  <th>Charity Events</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${pipelinerRows}
              </tbody>
            </table>
            <p class="note">Status indicates if pipeliners currently meet membership requirements.</p>
          </section>

          <div class="note">
            Data is trimmed to the most recent or highest-impact records for readability. Download the individual exports for comprehensive datasets.
          </div>

          <div class="footer">Adopt | Adapt | Improve</div>
        </div>
      `;

      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.top = "-10000px";
      container.style.left = "0";
      container.style.width = "1200px";
      container.style.zIndex = "9999";
      container.innerHTML = combinedHtml;
      document.body.appendChild(container);

      const reportElement = container.querySelector(".combined-report") as HTMLElement | null;
      if (!reportElement) {
        throw new Error("Unable to build combined report.");
      }

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageProps = pdf.getImageProperties(imageData);
      const pdfHeight = (imageProps.height * pageWidth) / imageProps.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, 0, pageWidth, pdfHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, pageWidth, pdfHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      pdf.save(`RTL32_All_Reports_${new Date().toISOString().split("T")[0]}.pdf`);
      updateExportTimestamp("combinedPdf");
      toast.success("Combined reports PDF exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to generate combined reports PDF.");
    } finally {
      restoreColors?.();
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setExportingKey(null);
    }
  }, [
    activeMembers.length,
    attendanceByMeeting,
    averageAttendance,
    bestPerformer,
    guests,
    meetingsSorted,
    memberStats,
    membersAtRisk,
    pipeliners,
    totalMeetingsHeld,
    updateExportTimestamp,
  ]);

  const exportAttendanceWorkbook = useCallback(async () => {
    try {
      setExportingKey("attendanceWorkbook");
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const memberSheetData = [
        ["Member", "Email", "Phone", "Join Date", "Status", "Meetings", "Present", "Apologies", "Absent", "Attendance %"],
        ...memberStats.map((member) => [
          member.full_name,
          member.email ?? "",
          member.phone ?? "",
          member.join_date ?? "",
          member.status ?? "",
          member.total_meetings,
          member.present_count,
          member.apologies,
          member.absences,
          member.attendancePercentage,
        ]),
      ];

      const attendanceHeaders = [
        "Member",
        ...meetingsSorted.map((meeting) =>
          formatDateLabel(meeting.meeting_date, meeting.meeting_date ?? "Meeting"),
        ),
        "Attendance %",
      ];

      const attendanceSheetData = [
        attendanceHeaders,
        ...sortedMembersForMatrix.map((member) => {
          const joinDate = parseDate(member.join_date);
          const row = meetingsSorted.map((meeting) => {
            const meetingDate = parseDate(meeting.meeting_date);
            if (!meetingDate || !joinDate) return "—";
            if (meetingDate < joinDate) return "-";
            const record =
              attendanceByMember.get(member.id)?.get(meeting.id)?.status ?? "absent";
            return STATUS_SYMBOLS[record]?.symbol ?? "X";
          });

          return [member.full_name, ...row, `${member.attendancePercentage}%`];
        }),
      ];

      const meetingsSheetData = [
        ["Date", "Type", "Location", "Total Attendance Recorded"],
        ...meetingsSorted.map((meeting) => {
          const records = attendanceByMeeting.get(meeting.id) ?? [];
          return [
            formatDateLabel(meeting.meeting_date),
            meeting.meeting_type ?? "business",
            meeting.location ?? "",
            records.length,
          ];
        }),
      ];

      const guestsSheetData = [
        ["Name", "Email", "Phone", "Invited By", "Meetings", "Status", "Eligible"],
        ...guests.map((guest) => [
          guest.full_name,
          guest.email ?? "",
          guest.phone ?? "",
          guest.invited_by ?? "",
          guest.meeting_count,
          guest.status,
          guest.eligible_for_pipeliner ? "Yes" : "No",
        ]),
      ];

      const pipelinerSheetData = [
        ["Name", "Email", "Phone", "Meeting Count", "Charity Events", "Status", "Eligible"],
        ...pipeliners.map((pipeliner) => [
          pipeliner.full_name,
          pipeliner.email ?? "",
          pipeliner.phone ?? "",
          pipeliner.meeting_count,
          pipeliner.charity_event_count,
          pipeliner.status,
          pipeliner.meets_requirements ? "Yes" : "No",
        ]),
      ];

      const memberSheet = XLSX.utils.aoa_to_sheet(memberSheetData);
      const attendanceSheet = XLSX.utils.aoa_to_sheet(attendanceSheetData);
      const meetingsSheet = XLSX.utils.aoa_to_sheet(meetingsSheetData);
      const guestsSheet = XLSX.utils.aoa_to_sheet(guestsSheetData);
      const pipelinerSheet = XLSX.utils.aoa_to_sheet(pipelinerSheetData);

      XLSX.utils.book_append_sheet(workbook, memberSheet, "Members");
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance");
      XLSX.utils.book_append_sheet(workbook, meetingsSheet, "Meetings");
      XLSX.utils.book_append_sheet(workbook, guestsSheet, "Guests");
      XLSX.utils.book_append_sheet(workbook, pipelinerSheet, "Pipeliners");

      const filename = `attendance-report-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      updateExportTimestamp("attendanceWorkbook");
      toast.success("Attendance workbook exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to export attendance workbook.");
    } finally {
      setExportingKey(null);
    }
  }, [
    attendanceByMeeting,
    attendanceByMember,
    guests,
    meetingsSorted,
    memberStats,
    pipeliners,
    sortedMembersForMatrix,
    updateExportTimestamp,
  ]);

  const exportCsv = useCallback(
    (rows: string[][], filename: string) => {
      const csvContent = rows
        .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [],
  );

  const exportMemberCsv = useCallback(() => {
    try {
      setExportingKey("memberCsv");
      const rows = [
        ["Name", "Email", "Phone", "Join Date", "Status", "Meetings", "Present", "Apologies", "Absent", "Attendance %"],
        ...memberStats.map((member) => [
          member.full_name,
          member.email ?? "",
          member.phone ?? "",
          member.join_date ?? "",
          member.status ?? "",
          String(member.total_meetings ?? 0),
          String(member.present_count ?? 0),
          String(member.apologies ?? 0),
          String(member.absences ?? 0),
          String(member.attendancePercentage),
        ]),
      ];
      exportCsv(rows, `members-${new Date().toISOString().split("T")[0]}.csv`);
      updateExportTimestamp("memberCsv");
      toast.success("Member list exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to export member list.");
    } finally {
      setExportingKey(null);
    }
  }, [exportCsv, memberStats, updateExportTimestamp]);

  const exportGuestCsv = useCallback(() => {
    try {
      setExportingKey("guestCsv");
      const rows = [
        ["Name", "Email", "Phone", "Invited By", "Meetings", "Status", "Eligible"],
        ...guests.map((guest) => [
          guest.full_name,
          guest.email ?? "",
          guest.phone ?? "",
          guest.invited_by ?? "",
          String(guest.meeting_count ?? 0),
          guest.status ?? "",
          guest.eligible_for_pipeliner ? "Yes" : "No",
        ]),
      ];
      exportCsv(rows, `guests-${new Date().toISOString().split("T")[0]}.csv`);
      updateExportTimestamp("guestCsv");
      toast.success("Guest list exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to export guest list.");
    } finally {
      setExportingKey(null);
    }
  }, [exportCsv, guests, updateExportTimestamp]);

  const exportPipelinerCsv = useCallback(() => {
    try {
      setExportingKey("pipelinerCsv");
      const rows = [
        ["Name", "Email", "Phone", "Meeting Count", "Charity Events", "Status", "Eligible"],
        ...pipeliners.map((pipeliner) => [
          pipeliner.full_name,
          pipeliner.email ?? "",
          pipeliner.phone ?? "",
          String(pipeliner.meeting_count ?? 0),
          String(pipeliner.charity_event_count ?? 0),
          pipeliner.status ?? "",
          pipeliner.meets_requirements ? "Yes" : "No",
        ]),
      ];
      exportCsv(rows, `pipeliners-${new Date().toISOString().split("T")[0]}.csv`);
      updateExportTimestamp("pipelinerCsv");
      toast.success("Pipeliner list exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to export pipeliner list.");
    } finally {
      setExportingKey(null);
    }
  }, [exportCsv, pipeliners, updateExportTimestamp]);

  const exportMeetingPdf = useCallback(async () => {
    try {
      setExportingKey("meetingPdf");
      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
      doc.setFontSize(18);
      doc.text("Meeting Summary", 40, 40);
      doc.setFontSize(12);
      doc.text(`Generated on ${format(new Date(), "dd MMM yyyy HH:mm")}`, 40, 60);

      const tableBody = meetingsSorted.map((meeting) => {
        const records = attendanceByMeeting.get(meeting.id) ?? [];
        const present = records.filter((record) => record.status === "present").length;
        const apologies = records.filter((record) => record.status === "apology").length;
        const attendanceRate =
          records.length === 0
            ? 0
            : Math.round(((present + 0.5 * apologies) / records.length) * 100);

        return [
          formatDateLabel(meeting.meeting_date),
          meeting.meeting_type ?? "business",
          meeting.location ?? "—",
          String(records.length),
          String(present),
          String(apologies),
          `${attendanceRate}%`,
        ];
      });

      autoTableModule.default(doc, {
        startY: 80,
        head: [["Date", "Type", "Location", "Total Records", "Present", "Apologies", "Attendance %"]],
        body: tableBody,
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [37, 99, 235] },
      });

      doc.save(`meeting-summary-${new Date().toISOString().split("T")[0]}.pdf`);
      updateExportTimestamp("meetingPdf");
      toast.success("Meeting summary PDF exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to export meeting summary.");
    } finally {
      setExportingKey(null);
    }
  }, [attendanceByMeeting, meetingsSorted, updateExportTimestamp]);

  const exportYearEndPdf = useCallback(async () => {
    try {
      setExportingKey("yearEndPdf");
      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
      doc.setFontSize(20);
      doc.text("Year-End Attendance Report", 40, 40);
      doc.setFontSize(12);
      doc.text(`Generated on ${format(new Date(), "dd MMM yyyy HH:mm")}`, 40, 60);

      doc.text(`Total Meetings Held: ${totalMeetingsHeld}`, 40, 90);
      doc.text(`Average Attendance: ${averageAttendance}%`, 40, 110);
      doc.text(`Members At Risk (<60%): ${membersAtRisk}`, 40, 130);
      doc.text(
        `Best Performer: ${
          bestPerformer ? `${bestPerformer.full_name} (${bestPerformer.attendancePercentage}%)` : "—"
        }`,
        40,
        150,
      );

      autoTableModule.default(doc, {
        startY: 180,
        head: [["Top Performers", "Attendance %", "Meetings"]],
        body: topPerformers.map((performer) => [
          performer.full_name,
          `${performer.attendancePercentage}%`,
          String(performer.total_meetings ?? 0),
        ]),
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [22, 163, 74] },
      });

      const autoTableState = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;

      autoTableModule.default(doc, {
        startY: autoTableState ? autoTableState.finalY + 20 : 220,
        head: [["Members At Risk", "Attendance %", "Meetings"]],
        body: memberStats
          .filter((member) => member.total_meetings > 0 && member.attendancePercentage < 60)
          .map((member) => [
            member.full_name,
            `${member.attendancePercentage}%`,
            String(member.total_meetings ?? 0),
          ]),
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [225, 29, 72] },
      });

      doc.save(`year-end-report-${new Date().toISOString().split("T")[0]}.pdf`);
      updateExportTimestamp("yearEndPdf");
      toast.success("Year-end report exported");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to export year-end report.");
    } finally {
      setExportingKey(null);
    }
  }, [
    averageAttendance,
    bestPerformer,
    membersAtRisk,
    memberStats,
    topPerformers,
    totalMeetingsHeld,
    updateExportTimestamp,
  ]);

  const handlePrintAttendance = useCallback(() => {
    window.print();
  }, []);

  const renderSummaryCards = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-none bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Meetings Held
          </CardTitle>
          <CalendarCheckIcon className="size-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-slate-900">{totalMeetingsHeld}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Meetings recorded within the current reporting window.
          </p>
        </CardContent>
      </Card>

      <Card className="border-none bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Average Attendance
          </CardTitle>
          <LineChartIcon className="size-5 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-slate-900">{averageAttendance}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Member attendance average across all recorded meetings.
          </p>
        </CardContent>
      </Card>

      <Card className="border-none bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Best Performer
          </CardTitle>
          <UsersIcon className="size-5 text-indigo-500" />
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-slate-900">
            {bestPerformer ? bestPerformer.full_name : "No data yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {bestPerformer
              ? `${bestPerformer.attendancePercentage}% attendance over ${
                  bestPerformer.total_meetings ?? 0
                } meetings.`
              : "Add meeting attendance to see top performers."}
          </p>
        </CardContent>
      </Card>

      <Card className="border-none bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Members at Risk
          </CardTitle>
          <AlertTriangleIcon className="size-5 text-rose-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-slate-900">{membersAtRisk}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Members below 60% attendance who may need follow-up.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderPerformers = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Top 5 Performers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Once attendance is recorded you will see top performers here.
            </p>
          ) : (
            topPerformers.map((member, index) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/90 text-sm font-semibold text-white">
                    {member.full_name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      #{index + 1} {member.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.total_meetings ?? 0} meetings recorded
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600">
                  {member.attendancePercentage}%
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Bottom 5 Performers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {bottomPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Attendance records are needed to highlight members who need support.
            </p>
          ) : (
            bottomPerformers.map((member, index) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-rose-500/90 text-sm font-semibold text-white">
                    {member.full_name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      #{index + 1} {member.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.total_meetings ?? 0} meetings recorded
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-rose-600">
                  {member.attendancePercentage}%
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderMonthComparisonChart = () => (
    <Card className="border-none shadow-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-base font-semibold text-slate-900">
          Month-by-Month Attendance Comparison
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Attendance breakdown for each month, including apologies.
        </p>
      </CardHeader>
      <CardContent className="h-80">
        {monthTrend.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
            Capture attendance data to view trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" stackId="a" fill="#16a34a" name="Present" />
              <Bar dataKey="apologies" stackId="a" fill="#f59e0b" name="Apologies" />
              <Bar dataKey="absences" stackId="a" fill="#ef4444" name="Absences" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderOverview = () => (
    <div className="space-y-8">
      {renderSummaryCards()}
      {renderPerformers()}
      {renderMonthComparisonChart()}
    </div>
  );

  const renderAttendanceMatrix = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print-transparent">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Attendance Matrix
            </h2>
            <p className="text-xs text-muted-foreground">
              Track attendance for every member across meetings. Rows are colour-coded based on overall attendance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance-desc">Attendance %</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={handlePrintAttendance}>
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
              {meetingsSorted.map((meeting) => (
                <TableHead
                  key={meeting.id}
                  className="report-col rotate-0 bg-white text-center text-xs font-semibold text-muted-foreground print-transparent"
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
            {sortedMembersForMatrix.map((member) => {
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
                  {meetingsSorted.map((meeting) => {
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

  const renderTrends = () => (
    <div className="space-y-8">
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Attendance Trends
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Track average attendance and compare selected members over time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {memberStats.slice(0, 12).map((member) => {
              const isSelected = selectedMemberIds.includes(member.id);
              return (
                <Button
                  key={member.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs",
                    isSelected ? "bg-slate-900 text-white" : "text-slate-600",
                  )}
                  onClick={() => toggleMemberSelection(member.id)}
                >
                  {member.full_name.split(" ")[0]}
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="h-96">
          {monthTrend.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
              Add attendance records to unlock trend analysis.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  name="Overall"
                />
                {selectedMemberIds.map((memberId, index) => {
                  const colorPalette = ["#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0891b2"];
                  const member = memberStats.find((item) => item.id === memberId);
                  return (
                    <Line
                      key={memberId}
                      type="monotone"
                      dataKey={memberId}
                      stroke={colorPalette[index % colorPalette.length]}
                      strokeWidth={2}
                      dot={false}
                      name={member ? member.full_name : `Member ${index + 1}`}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Meeting Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {meetings.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
                Meeting data required to show breakdown.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(meetingTypeCounts).map(([type, value]) => ({
                      name: type.charAt(0).toUpperCase() + type.slice(1),
                      value,
                    }))}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {Object.entries(meetingTypeCounts).map(([type], index) => (
                      <Cell
                        key={type}
                        fill={MEETING_TYPE_COLORS[type] ?? ["#2563eb", "#16a34a", "#e11d48"][index % 3]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Attendance by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {attendanceByDay.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
                Attendance records needed to calculate day patterns.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="attendancePercentage" fill="#0ea5e9" name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderExport = () => {
  const exportButtons: Array<{
    key: ExportKey;
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    action: () => void | Promise<void>;
  }> = [
      {
        key: "combinedPdf",
        title: "Leadership Snapshot (PDF)",
        description: "Single PDF combining key insights from every export with branded styling.",
        icon: FileTextIcon,
        action: exportCombinedPdf,
      },
      {
        key: "attendanceWorkbook",
        title: "Full Attendance Report (Excel)",
        description: "Multi-sheet workbook including members, attendance matrix, meetings, guests, and pipeliners.",
        icon: FileSpreadsheetIcon,
        action: exportAttendanceWorkbook,
      },
      {
        key: "memberCsv",
        title: "Member List (CSV)",
        description: "Full member directory with attendance stats.",
        icon: DownloadIcon,
        action: exportMemberCsv,
      },
      {
        key: "guestCsv",
        title: "Guest List (CSV)",
        description: "Guests with meeting counts and eligibility.",
        icon: DownloadIcon,
        action: exportGuestCsv,
      },
      {
        key: "pipelinerCsv",
        title: "Pipeliner List (CSV)",
        description: "Pipeliner eligibility insights and contact info.",
        icon: DownloadIcon,
        action: exportPipelinerCsv,
      },
      {
        key: "meetingPdf",
        title: "Meeting Summary (PDF)",
        description: "Landscape PDF with attendance breakdown per meeting.",
        icon: FileTextIcon,
        action: exportMeetingPdf,
      },
      {
        key: "yearEndPdf",
        title: "Year-End Report (PDF)",
        description: "Comprehensive PDF covering highlights, risks, and top performers.",
        icon: FileTextIcon,
        action: exportYearEndPdf,
      },
    ];

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {exportButtons.map((item) => {
          const Icon = item.icon;
          const timestamp = lastExportTimes[item.key];
          return (
            <Card key={item.key} className="border border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {item.title}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Icon className="size-6 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button
                  onClick={() => item.action()}
                  className="w-full gap-2"
                  disabled={exportingKey === item.key}
                >
                  {exportingKey === item.key ? (
                    <>
                      <RefreshCcwIcon className="size-4 animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="size-4" />
                      Download
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Last exported: {timestamp ? format(timestamp, "dd MMM yyyy HH:mm") : "Never"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const tabs: Array<{
    id: typeof activeTab;
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    {
      id: "overview",
      label: "Overview",
      description: "Highlights, key stats, and leaderboards",
      icon: BarChart3Icon,
    },
    {
      id: "matrix",
      label: "Attendance Table",
      description: "Full attendance matrix with print view",
      icon: UsersIcon,
    },
    {
      id: "trends",
      label: "Trends",
      description: "Charts and attendance insights",
      icon: LineChartIcon,
    },
    {
      id: "export",
      label: "Export",
      description: "Download reports and datasets",
      icon: DownloadIcon,
    },
  ];

  useEffect(() => {
    if (selectedMemberIds.length === 0 && memberStats.length > 0) {
      setSelectedMemberIds(memberStats.slice(0, 3).map((member) => member.id));
    }
  }, [memberStats, selectedMemberIds.length]);

  return (
    <div className="bg-slate-50/70 pb-16 pt-8">
      <div className="page-shell section-stack">
        <header className="flex flex-col gap-responsive border-b border-slate-200 pb-6 print-hide">
        <div className="flex flex-col gap-responsive md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Reports & Data Export
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Analyse attendance performance, discover trends, and export datasets for deeper analysis or sharing with leadership.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={loading}>
              {loading ? (
                <RefreshCcwIcon className="size-4 animate-spin" />
              ) : (
                <RefreshCcwIcon className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col rounded-xl border p-3 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600",
                  "w-full max-w-xs sm:w-auto",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className={cn("size-4", isActive ? "text-white" : "text-slate-400")} />
                  {tab.label}
                </div>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    isActive ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {tab.description}
                </p>
              </button>
            );
          })}
        </nav>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
          Loading report data…
        </div>
      ) : (
        <>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "matrix" && renderAttendanceMatrix()}
          {activeTab === "trends" && renderTrends()}
          {activeTab === "export" && renderExport()}
        </>
      )}
      </div>
    </div>
  );
}


