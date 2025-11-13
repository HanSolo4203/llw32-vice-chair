"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TrendingUpIcon,
  User2Icon,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, isValid, parseISO } from "date-fns";

import MemberDialog from "@/components/members/MemberDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { MemberFormValues } from "@/hooks/useMembers";
import { useMemberAttendance } from "@/hooks/useMemberAttendance";

function getStatusBadgeVariant(status: string | null) {
  if (!status) return "bg-muted text-muted-foreground border-muted";
  const normalized = status.toLowerCase();
  if (normalized === "active") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (normalized === "inactive") {
    return "bg-rose-100 text-rose-700 border-rose-200";
  }
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = parseISO(value);
  if (!isValid(date)) return value;
  return format(date, "dd MMM yyyy");
}

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const memberId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { member, history, loading, error, stats, trendData, refresh } =
    useMemberAttendance(memberId ?? null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const attendanceHistory = useMemo(() => history, [history]);

  const handleUpdateMember = async (values: MemberFormValues) => {
    if (!memberId) return;
    setUpdating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const payload = {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone ?? null,
        member_number: values.member_number ?? null,
        join_date: values.join_date,
        status: values.status,
      };

      const { error: updateError } = await supabase
        .from("members")
        .update(payload)
        .eq("id", memberId);

      if (updateError) {
        throw updateError;
      }

      await refresh();
    } finally {
      setUpdating(false);
    }
  };

  if (!memberId) {
    return (
      <div className="page-shell section-stack items-center text-center">
        <p className="text-lg font-semibold text-foreground">
          Member not found
        </p>
        <Button onClick={() => router.push("/members")}>
          <ArrowLeftIcon className="mr-2 size-4" />
          Back to members
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/60 pb-16 pt-8">
      <div className="page-shell section-stack">
        <div className="flex flex-col justify-between gap-responsive md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="px-0 text-muted-foreground"
            onClick={() => router.push("/members")}
          >
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to members
          </Button>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!member}>
          Edit Profile
        </Button>
      </div>

  <Card className="border-none shadow-sm">
    <CardContent className="flex flex-col gap-responsive p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
        {member?.profile_photo_url ? (
          <div className="relative size-24 overflow-hidden rounded-full border">
            <Image
              src={member.profile_photo_url}
              alt={member.full_name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User2Icon className="size-10" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            {member?.full_name ?? "Loading member..."}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Member #{member?.member_number ?? "—"}
          </p>
          {member && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MailIcon className="size-4" />
                <span>{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="size-4" />
                  <span>{member.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4" />
                <span>Joined {formatDate(member.join_date)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 self-stretch md:items-end">
        <Badge className={getStatusBadgeVariant(member?.status ?? null)}>
          {member?.status
            ? member.status.charAt(0).toUpperCase() + member.status.slice(1)
            : "Unknown"}
        </Badge>
        {member?.last_meeting_date && (
          <p className="text-muted-foreground text-sm">
            Last meeting: {formatDate(member.last_meeting_date)}
          </p>
        )}
      </div>
    </CardContent>
  </Card>

      <div className="grid gap-responsive md:grid-cols-4">
        <Card className="border-none bg-emerald-50/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Attendance %</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {stats.attendancePercentage}%
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <TrendingUpIcon className="size-4" />
            {stats.trendDelta === null
              ? "Stable attendance"
              : `${stats.trendDelta > 0 ? "+" : ""}${stats.trendDelta}% vs last period`}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Meetings</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {stats.totalMeetings}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Across all tracked periods
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Meetings Attended</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {stats.attended}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats.apologies} apologies • {stats.absences} absences
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Next Steps</CardDescription>
            <CardTitle className="text-base font-medium text-foreground">
              Stay Engaged
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Encourage follow-up ahead of upcoming meetings to keep attendance
            momentum going.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-responsive lg:grid-cols-5">
        <Card className="border-none shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>
              Percentage attendance per month across the last meetings.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {trendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                Not enough data to display a trend yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "rgba(148, 163, 184, 0.3)",
                    }}
                    formatter={(value: number) => [`${value}%`, "Attendance"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#047857"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile Overview</CardTitle>
            <CardDescription>
              Snapshot of the member&apos;s key information.
            </CardDescription>
          </CardHeader>
          <CardContent className="section-stack">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <CalendarIcon className="size-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium">Join Date</p>
                <p className="text-muted-foreground text-sm">
                  {formatDate(member?.join_date ?? null)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <MailIcon className="size-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium">Email Address</p>
                <p className="text-muted-foreground text-sm">
                  {member?.email ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <PhoneIcon className="size-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium">Phone Number</p>
                <p className="text-muted-foreground text-sm">
                  {member?.phone ?? "—"}
                </p>
              </div>
            </div>
            {member?.last_meeting_date && (
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <MapPinIcon className="size-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium">Last Meeting</p>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(member.last_meeting_date)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>
            Full breakdown of every recorded meeting and attendance status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Meeting Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: 5 }).map((__, colIndex) => (
                          <TableCell key={colIndex}>
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                ) : attendanceHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No attendance records available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.meetingDate)}</TableCell>
                      <TableCell>{record.meetingType ?? "—"}</TableCell>
                      <TableCell>{record.location ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            record.status === "present"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : record.status === "apology"
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-rose-100 text-rose-700 border-rose-200"
                          }
                        >
                          {record.status.charAt(0).toUpperCase() +
                            record.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4 md:hidden">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-3 h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))
              : attendanceHistory.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {formatDate(record.meetingDate)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {record.meetingType ?? "Meeting"}
                        </p>
                      </div>
                      <Badge
                        className={
                          record.status === "present"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : record.status === "apology"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-rose-100 text-rose-700 border-rose-200"
                        }
                      >
                        {record.status}
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="size-4" />
                        <span>{record.location ?? "—"}</span>
                      </div>
                      {record.notes && (
                        <p className="mt-2 text-xs">Note: {record.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      <MemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={member}
        mode="edit"
        loading={updating}
        onSubmit={handleUpdateMember}
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading attendance data...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      </div>
    </div>
  );
}

