"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDownIcon,
  EditIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  UserCircleIcon,
} from "lucide-react";

import MemberDialog from "@/components/members/MemberDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sortMembersByHierarchy, useMembers } from "@/hooks/useMembers";
import type { MemberAttendanceSummary } from "@/types/database";

type SortOption = "hierarchy" | "name-asc" | "attendance-desc";

const STATUS_ORDER = ["active", "probation", "sabbatical", "inactive"] as const;
type KnownStatus = (typeof STATUS_ORDER)[number];

function normalizeStatus(status?: string | null): KnownStatus | "" {
  const normalized = status?.toLowerCase().trim() ?? "";
  return STATUS_ORDER.includes(normalized as KnownStatus)
    ? (normalized as KnownStatus)
    : "";
}

function groupMembersByStatus(
  members: MemberAttendanceSummary[],
): MemberAttendanceSummary[] {
  const grouped = STATUS_ORDER.flatMap((status) =>
    members.filter((member) => normalizeStatus(member.status) === status),
  );
  const remaining = members.filter(
    (member) => normalizeStatus(member.status) === "",
  );
  return [...grouped, ...remaining];
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status);
  let badgeClass =
    "bg-muted text-foreground border-transparent dark:bg-slate-800 dark:text-slate-300";

  if (normalized === "active") {
    badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
  } else if (normalized === "probation") {
    badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
  } else if (normalized === "sabbatical") {
    badgeClass = "bg-sky-100 text-sky-700 border-sky-200";
  } else if (normalized === "inactive") {
    badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
  }

  const label =
    status && status.trim()
      ? status
      : normalized
      ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
      : "Unknown";

  return <Badge className={`capitalize ${badgeClass}`}>{label}</Badge>;
}

function getAttendancePercent(member: MemberAttendanceSummary) {
  if (!member.total_meetings) return 0;
  return Math.round((member.present_count / member.total_meetings) * 100);
}

function AttendanceBadge({ value }: { value: number }) {
  let badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";

  if (value < 60) {
    badgeClass = "bg-rose-100 text-rose-700 border-rose-200";
  } else if (value < 80) {
    badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
  }

  return (
    <Badge className={badgeClass}>
      {value}%
    </Badge>
  );
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <TableRow>
      {Array.from({ length: columns }).map((_, index) => (
        <TableCell key={index}>
          <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("hierarchy");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedMember, setSelectedMember] =
    useState<MemberAttendanceSummary | null>(null);

  const {
    members,
    loading,
    error,
    creating,
    updatingId,
    createMember,
    updateMember,
  } = useMembers();

  const filteredMembers = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return members.filter((member) =>
      member.full_name.toLowerCase().includes(lowerSearch)
    );
  }, [members, searchTerm]);

  const sortedMembers = useMemo(() => {
    if (sortOption === "attendance-desc") {
      const base = [...filteredMembers].sort(
        (a, b) => getAttendancePercent(b) - getAttendancePercent(a),
      );
      return groupMembersByStatus(base);
    }

    if (sortOption === "name-asc") {
      const base = [...filteredMembers].sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      );
      return groupMembersByStatus(base);
    }

    const base = sortMembersByHierarchy(filteredMembers);
    return groupMembersByStatus(base);
  }, [filteredMembers, sortOption]);

  const handleAddMember = () => {
    setDialogMode("create");
    setSelectedMember(null);
    setDialogOpen(true);
  };

  const handleEditMember = (member: MemberAttendanceSummary) => {
    setDialogMode("edit");
    setSelectedMember(member);
    setDialogOpen(true);
  };

  const handleDialogSubmit = async (values: Parameters<typeof createMember>[0]) => {
    if (dialogMode === "create") {
      await createMember(values);
    } else if (selectedMember) {
      await updateMember(selectedMember.id, values);
    }
  };

  const isDialogLoading =
    dialogMode === "create"
      ? creating
      : selectedMember
      ? updatingId === selectedMember.id
      : false;

  return (
    <div className="bg-slate-50/60 pb-16 pt-8">
      <div className="page-shell section-stack">
        <div className="flex flex-col justify-between gap-responsive md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Members
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
            Manage Round Table members, review attendance performance, and keep
            details up to date.
          </p>
        </div>
        <Button onClick={handleAddMember} className="self-start md:self-auto">
          <PlusIcon className="mr-2 size-4" />
          Add New Member
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-responsive pb-0 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg font-semibold">Member Directory</CardTitle>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <div className="relative w-full md:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={sortOption}
              onValueChange={(value) => setSortOption(value as SortOption)}
            >
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hierarchy">
                  <div className="flex items-center gap-2">
                    <ArrowUpDownIcon className="size-4" />
                    Hierarchy (Chairman first)
                  </div>
                </SelectItem>
                <SelectItem value="name-asc">
                  <div className="flex items-center gap-2">
                    <ArrowUpDownIcon className="size-4" />
                    Name (A-Z)
                  </div>
                </SelectItem>
                <SelectItem value="attendance-desc">
                  <div className="flex items-center gap-2">
                    <ArrowUpDownIcon className="size-4" />
                    Attendance %
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="section-stack pt-6">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Member #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">
                    Meetings (Present / Total)
                  </TableHead>
                  <TableHead className="text-center">Attendance %</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <SkeletonRow key={index} columns={7} />
                    ))}
                  </>
                ) : sortedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UserCircleIcon className="size-8" />
                        <span>No members found matching your filters.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedMembers.map((member) => {
                    const attendancePercent = getAttendancePercent(member);
                    const meetingsLabel = `${member.present_count} / ${member.total_meetings}`;

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {member.full_name}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Joined {new Date(member.join_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>{member.member_number ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={member.status} />
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell className="text-center">
                          {meetingsLabel}
                        </TableCell>
                        <TableCell className="text-center">
                          <AttendanceBadge value={attendancePercent} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditMember(member)}
                            >
                              <EditIcon className="mr-2 size-4" />
                              Edit
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/members/${member.id}`}>
                                View Profile
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
                    <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="mb-3 h-4 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="mb-4 flex gap-2">
                      <span className="block h-4 w-20 animate-pulse rounded bg-muted" />
                      <span className="block h-4 w-16 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="flex gap-2">
                      <span className="block h-9 w-full animate-pulse rounded bg-muted" />
                      <span className="block h-9 w-full animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))
              : sortedMembers.map((member) => {
                  const attendancePercent = getAttendancePercent(member);
                  const meetingsLabel = `${member.present_count} / ${member.total_meetings}`;
                  return (
                    <div
                      key={member.id}
                      className="rounded-xl border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {member.full_name}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {member.email}
                          </p>
                          <div className="mt-1">
                            <StatusBadge status={member.status} />
                          </div>
                        </div>
                        <AttendanceBadge value={attendancePercent} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Member #
                          </span>
                          <p className="font-medium">
                            {member.member_number ?? "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Meetings
                          </span>
                          <p className="font-medium">{meetingsLabel}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEditMember(member)}
                        >
                          <EditIcon className="mr-2 size-4" />
                          Edit
                        </Button>
                        <Button asChild className="flex-1">
                          <Link href={`/members/${member.id}`}>Profile</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </CardContent>
      </Card>

      <MemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={dialogMode === "edit" ? selectedMember : null}
        mode={dialogMode}
        loading={isDialogLoading}
        onSubmit={handleDialogSubmit}
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading members...
        </div>
      )}
      </div>
    </div>
  );
}

