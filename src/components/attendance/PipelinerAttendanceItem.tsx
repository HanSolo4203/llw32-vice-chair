"use client";

import { memo, useMemo } from "react";
import { Loader2Icon, ShieldCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PipelinerEligibility } from "@/types/database";

type PipelinerAttendanceItemProps = {
  pipeliner: PipelinerEligibility;
  attended: boolean;
  disabled?: boolean;
  saving?: boolean;
  promoting?: boolean;
  onToggle: (checked: boolean) => void;
  onPromote?: () => void;
};

const PipelinerAttendanceItem = memo(function PipelinerAttendanceItem({
  pipeliner,
  attended,
  disabled = false,
  saving = false,
  promoting = false,
  onToggle,
  onPromote,
}: PipelinerAttendanceItemProps) {
  const businessProgress = useMemo(() => {
    const value = pipeliner.business_meetings_count ?? 0;
    return Math.min(value, 3);
  }, [pipeliner.business_meetings_count]);

  const charityProgress = useMemo(() => {
    const value =
      pipeliner.charity_event_count ??
      pipeliner.charity_events_count ??
      0;
    return Math.min(value, 1);
  }, [pipeliner.charity_event_count, pipeliner.charity_events_count]);

  const eligible =
    (pipeliner.meets_requirements ?? false) ||
    businessProgress >= 3 ||
    charityProgress >= 1;

  return (
    <Card
      className={cn(
        "flex flex-col gap-5 rounded-2xl border p-4 shadow-sm transition-all duration-200 sm:p-5",
        eligible && "border-emerald-200 bg-emerald-50/80",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {pipeliner.full_name}
            {eligible && (
              <Badge className="gap-1 bg-emerald-600 text-xs text-white">
                <ShieldCheckIcon className="size-3.5" />
                Eligible for Membership
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {pipeliner.email && <span>{pipeliner.email}</span>}
            {pipeliner.phone && <span>{pipeliner.phone}</span>}
            {pipeliner.sponsored_by && (
              <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                Sponsored
              </span>
            )}
          </div>
        </div>
        <label className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 md:w-auto md:justify-start md:border-0 md:bg-transparent md:px-0 md:py-0">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
            checked={attended}
            disabled={disabled || saving}
            onChange={(event) => onToggle(event.target.checked)}
          />
          Attended
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>Business Meetings</span>
            <span>
              {businessProgress}/3 ({pipeliner.business_meetings_count ?? 0})
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${(businessProgress / 3) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>Charity Events</span>
            <span>
              {charityProgress}/1 ({pipeliner.charity_events_count ?? 0})
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-200"
              style={{ width: `${charityProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Business Meetings: {pipeliner.business_meetings_count ?? 0}/3 · Charity
          Events: {pipeliner.charity_events_count ?? 0}/1
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full gap-2 sm:w-auto"
          disabled={promoting || !eligible}
          onClick={onPromote}
        >
          {promoting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <ShieldCheckIcon className="size-4" />
          )}
          Promote to Member
        </Button>
      </div>
    </Card>
  );
});

export default PipelinerAttendanceItem;


