"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Rocket, Users } from "lucide-react";

import ActionAlerts from "@/components/dashboard/ActionAlerts";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import MemberList from "@/components/dashboard/MemberList";
import QuickActions from "@/components/dashboard/QuickActions";
import StatsCard from "@/components/dashboard/StatsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDashboardAttendance,
  type AttendanceRange,
} from "@/hooks/useDashboardAttendance";
import { useDashboardStats } from "@/hooks/useDashboardStats";

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-36 rounded-3xl" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [attendanceRange, setAttendanceRange] =
    useState<AttendanceRange>("6m");

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats();

  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    isFetching: attendanceFetching,
    error: attendanceError,
    refetch: refetchAttendance,
  } = useDashboardAttendance(attendanceRange);

  const attendanceAverage = stats?.attendance?.averagePercentage ?? null;
  const attendanceDelta = stats?.attendance?.deltaFromTarget ?? null;

  const attendanceCardClass =
    attendanceAverage == null
      ? "from-emerald-600 via-emerald-500 to-emerald-400"
      : attendanceAverage > 80
        ? "from-emerald-600 via-emerald-500 to-emerald-400"
        : attendanceAverage >= 60
          ? "from-amber-500 via-amber-400 to-amber-300"
          : "from-red-600 via-red-500 to-red-400";

  const attendanceTrendText =
    attendanceDelta == null || Number.isNaN(attendanceDelta)
      ? undefined
      : attendanceDelta === 0
        ? "On track with 80% target"
        : `${attendanceDelta > 0 ? "▲" : "▼"} ${Math.abs(attendanceDelta).toFixed(1)}% ${attendanceDelta > 0 ? "above" : "below"} target`;

  return (
    <div className="bg-slate-50 pb-10 pt-6 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="page-shell section-stack pb-16">
        <header className="flex flex-col gap-responsive">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Round Table Lilongwe 32 Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Stay on top of membership health, attendance trends, and pipeline momentum in real time.
          </p>
        </header>

        {statsError ? (
          <Alert variant="destructive" className="border-none shadow-lg shadow-red-500/20">
            <AlertTitle>Unable to load dashboard data</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Something went wrong while fetching the latest metrics. Please try again.</span>
              <Button variant="outline" onClick={() => refetchStats()} className="w-full gap-2 sm:w-auto">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : statsLoading ? (
          <StatCardsSkeleton />
        ) : (
          <section className="grid gap-responsive sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Total Members"
              icon={<Users className="size-6" />}
              value={stats?.totals.memberCount ?? null}
              trend={`+${stats?.totals.newMembersThisYear ?? 0} new this year`}
              backgroundClassName="from-blue-700 via-blue-600 to-blue-500"
            />
            <StatsCard
              title="Average Attendance"
              icon={<CheckCircle2 className="size-6" />}
              value={attendanceAverage}
              decimals={1}
              suffix="%"
              trend={attendanceTrendText}
              backgroundClassName={attendanceCardClass}
            />
            <StatsCard
              title="Active Pipeline"
              icon={<Rocket className="size-6" />}
              value={stats?.pipeline.activeCount ?? null}
              trend={`${stats?.pipeline.eligibleCount ?? 0} eligible for promotion`}
              backgroundClassName="from-amber-500 via-amber-400 to-amber-300"
            />
            <StatsCard
              title="Next Meeting"
              icon={<CalendarDays className="size-6" />}
              value={stats?.nextMeeting?.daysUntil ?? null}
              renderValue={(value) => {
                const rounded = Math.round(value);
                if (rounded <= 0) return "Today";
                if (rounded === 1) return "In 1 day";
                return `In ${rounded} days`;
              }}
              fallback="No meeting scheduled"
              trend={
                stats?.nextMeeting
                  ? `${stats.nextMeeting.formattedDate} • ${stats.nextMeeting.location ?? "Location TBC"}`
                  : undefined
              }
              backgroundClassName="from-indigo-600 via-indigo-500 to-indigo-400"
            />
          </section>
        )}

        <section className="grid gap-responsive lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <AttendanceChart
              data={attendanceData?.points}
              target={stats?.attendance.target ?? 80}
              range={attendanceRange}
              onRangeChange={(value) => setAttendanceRange(value)}
              isLoading={attendanceLoading}
              isFetching={attendanceFetching}
              error={attendanceError}
              onRetry={() => refetchAttendance()}
            />
            <section className="grid gap-6 lg:grid-cols-2">
              <MemberList
                title="🏆 Top Performers"
                subtitle="Members with 90%+ attendance"
                members={stats?.members.topPerformers}
                totalCount={stats?.members.topPerformersCount}
                footerHref="/members"
                positive
                isLoading={statsLoading}
              />
              <MemberList
                title="⚠️ Need Attention"
                subtitle="Members below 70% attendance"
                members={stats?.members.atRisk}
                totalCount={stats?.members.atRiskCount}
                footerHref="/attendance"
                isLoading={statsLoading}
                badges={[
                  {
                    label: `🔴 ${stats?.members.criticalCount ?? 0} Critical (<60%)`,
                    tone: "danger",
                  },
                  {
                    label: `🟡 ${stats?.members.warningCount ?? 0} Warning (60-70%)`,
                    tone: "warning",
                  },
                ]}
              />
            </section>
        </div>
          <aside className="flex h-full flex-col gap-responsive">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Action Alerts
            </h2>
            <ActionAlerts alerts={stats?.alerts} />
          </aside>
        </section>
      </main>
      <QuickActions />
    </div>
  );
}
