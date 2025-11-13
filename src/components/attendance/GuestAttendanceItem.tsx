"use client";

import { memo } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GuestMeetingCounts } from "@/types/database";

type GuestAttendanceItemProps = {
  guest: GuestMeetingCounts;
  attended: boolean;
  eligible: boolean;
  disabled?: boolean;
  saving?: boolean;
  promoting?: boolean;
  onToggle: (checked: boolean) => void;
  onPromote?: () => void;
};

function toOrdinal(value: number) {
  if (value <= 0) return `${value}`;
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

const GuestAttendanceItem = memo(function GuestAttendanceItem({
  guest,
  attended,
  eligible,
  disabled = false,
  saving = false,
  promoting = false,
  onToggle,
  onPromote,
}: GuestAttendanceItemProps) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-4 shadow-sm transition-all duration-200 sm:p-5",
        eligible && "border-indigo-200 bg-indigo-50/80",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {guest.full_name}
            {eligible && (
              <Badge className="gap-1 bg-indigo-600 text-xs text-white">
                <SparklesIcon className="size-3.5" />
                Eligible for Pipeliner!
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
              {toOrdinal(guest.meeting_count)} meeting
            </span>
            {guest.email && <span>{guest.email}</span>}
            {guest.phone && <span>{guest.phone}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 sm:w-auto sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
              checked={attended}
              disabled={disabled || saving}
              onChange={(event) => onToggle(event.target.checked)}
            />
            Attended
          </label>
          <Button
            type="button"
            size="sm"
            className="w-full gap-2 sm:w-auto"
            variant="outline"
            disabled={!eligible || promoting}
            onClick={onPromote}
          >
            {promoting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SparklesIcon className="size-4 text-indigo-600" />
            )}
            Promote to Pipeliner
          </Button>
        </div>
      </div>
    </Card>
  );
});

export default GuestAttendanceItem;


