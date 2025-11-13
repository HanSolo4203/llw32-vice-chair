"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, RefreshCcw } from "lucide-react";

import {
  type AttendancePoint,
  type AttendanceRange,
} from "@/hooks/useDashboardAttendance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type AttendanceChartProps = {
  data?: AttendancePoint[];
  target: number;
  range: AttendanceRange;
  onRangeChange: (range: AttendanceRange) => void;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRetry: () => void;
};

const rangeLabels: Record<AttendanceRange, string> = {
  "6m": "Last 6 months",
  "1y": "Last year",
  all: "All time",
};

function formatTooltip(
  point: AttendancePoint | undefined
): { title: string; description: string } {
  if (!point) {
    return {
      title: "",
      description: "",
    };
  }
  return {
    title: point.formattedDate,
    description: `${point.presentCount}/${point.totalMembers} present • ${point.attendancePercentage.toFixed(
      1
    )}%`,
  };
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function CustomTooltip({
  active,
  payload,
  label,
  points,
}: TooltipProps & { points?: AttendancePoint[] }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = points?.find((item) => item.label === label);
  const tooltipData = formatTooltip(point);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {tooltipData.title}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
        {tooltipData.description}
      </p>
    </div>
  );
}

export function AttendanceChart({
  data,
  target,
  range,
  onRangeChange,
  isLoading,
  isFetching,
  error,
  onRetry,
}: AttendanceChartProps) {
  const points = data ?? [];

  return (
    <Card className="h-full overflow-hidden border-none bg-white shadow-lg shadow-slate-200/60 transition hover:shadow-xl dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-100/70 bg-slate-50/70 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/70 dark:bg-slate-900/40">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Attendance Trend
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
            Track member attendance versus the 80% target.
          </CardDescription>
        </div>
        <Select
          value={range}
          onValueChange={(value) => onRangeChange(value as AttendanceRange)}
        >
          <SelectTrigger className="w-full rounded-full border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(rangeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="relative h-[18rem] px-2 pb-4 pt-6 sm:h-[22rem] lg:h-[25rem]">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="size-5" />
              <AlertTitle>Unable to load attendance</AlertTitle>
              <AlertDescription>
                Something went wrong while loading the attendance trends. Please try again.
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RefreshCcw className="size-4" />
              Try again
            </Button>
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            No attendance data available for this range.
          </div>
        ) : (
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="#64748B"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fontSize: 12 }}
                  unit="%"
                />
                <Tooltip
                  content={
                    <CustomTooltip
                      points={points}
                      // Additional props provided by Recharts
                    />
                  }
                />
                <ReferenceLine
                  y={target}
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  label={{
                    value: `Target ${target}%`,
                    position: "insideTopLeft",
                    fill: "#64748B",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="attendancePercentage"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#ffffff",
                    fill: "#2563eb",
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            {isFetching && !isLoading && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-4">
                <span className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700">
                  <RefreshCcw className="size-3 animate-spin" />
                  Updating…
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AttendanceChart;


