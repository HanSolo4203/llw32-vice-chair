"use client";

import { memo, useMemo } from "react";
import { AlertTriangleIcon, CheckIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Attendance, MemberAttendanceSummary } from "@/types/database";

type AttendanceOption = {
  value: Attendance["status"];
  label: string;
  Icon: typeof CheckIcon;
  activeClass: string;
  baseClass: string;
};

const attendanceOptions: AttendanceOption[] = [
  {
    value: "present",
    label: "Present",
    Icon: CheckIcon,
    activeClass:
      "border-emerald-400 bg-emerald-100 text-emerald-700 shadow-sm scale-[1.02]",
    baseClass:
      "border-emerald-200/50 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-100/70",
  },
  {
    value: "apology",
    label: "Apology",
    Icon: AlertTriangleIcon,
    activeClass:
      "border-amber-400 bg-amber-100 text-amber-800 shadow-sm scale-[1.02]",
    baseClass:
      "border-amber-200/50 text-amber-700 hover:border-amber-400 hover:bg-amber-100/70",
  },
  {
    value: "absent",
    label: "Absent",
    Icon: XIcon,
    activeClass:
      "border-rose-400 bg-rose-100 text-rose-700 shadow-sm scale-[1.02]",
    baseClass:
      "border-rose-200/50 text-rose-600 hover:border-rose-400 hover:bg-rose-100/60",
  },
];

const statusThemes: Record<
  Attendance["status"] | "none",
  { border: string; badge: string; indicator: string }
> = {
  none: {
    border: "border-slate-200 bg-white hover:border-primary/40 hover:shadow-lg",
    badge: "hidden",
    indicator: "bg-slate-200",
  },
  present: {
    border: "border-emerald-200 bg-emerald-50/70",
    badge: "bg-emerald-500 text-white",
    indicator: "bg-emerald-500",
  },
  apology: {
    border: "border-amber-200 bg-amber-50/70",
    badge: "bg-amber-500 text-white",
    indicator: "bg-amber-500",
  },
  absent: {
    border: "border-rose-200 bg-rose-50/70",
    badge: "bg-rose-500 text-white",
    indicator: "bg-rose-500",
  },
};

function getInitials(fullName: string) {
  if (!fullName) return "";
  const [first, second] = fullName.trim().split(/\s+/);
  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first[0]}${second[0]}`.toUpperCase();
}

type MemberAttendanceCardProps = {
  member: MemberAttendanceSummary;
  status: Attendance["status"] | null;
  onStatusChange: (status: Attendance["status"] | null) => void;
  disabled?: boolean;
  dirty?: boolean;
};

const MemberAttendanceCard = memo(function MemberAttendanceCard({
  member,
  status,
  onStatusChange,
  disabled = false,
  dirty = false,
}: MemberAttendanceCardProps) {
  const attendancePercent = useMemo(() => {
    if (member.total_meetings === 0) return 0;
    return Math.round((member.present_count / member.total_meetings) * 100);
  }, [member.present_count, member.total_meetings]);

  const theme = statusThemes[status ?? "none"];
  const initials = getInitials(member.full_name);
  const photoUrl = member.profile_photo_url;

  return (
    <div
      className={cn(
        "flex transform flex-col gap-4 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5",
        theme.border,
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="size-12 overflow-hidden rounded-full border-2 border-white shadow">
            {photoUrl ? (
              <div
                className="size-full bg-cover bg-center"
                style={{ backgroundImage: `url(${photoUrl})` }}
                aria-label={`${member.full_name} profile photo`}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-slate-200 text-base font-semibold text-slate-700">
                {initials}
              </div>
            )}
          </div>
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex size-3 rounded-full border border-white transition-opacity",
              theme.indicator,
              status ? "opacity-100" : "opacity-0"
            )}
          />
          {dirty && (
            <span className="absolute -top-1 -right-1 flex size-2 rounded-full border border-white bg-primary" />
          )}
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-slate-900">
            {member.full_name}
          </span>
          <span className="text-xs text-muted-foreground">
            Attendance {attendancePercent}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {attendanceOptions.map(({ value, label, Icon, activeClass, baseClass }) => {
          const isActive = status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onStatusChange(isActive ? null : value)}
              className={cn(
                "flex flex-1 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40",
                "bg-white/90 backdrop-blur",
                "min-w-full sm:min-w-0",
                isActive ? activeClass : baseClass
              )}
              disabled={disabled}
            >
              <Icon className="mr-2 size-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default MemberAttendanceCard;


