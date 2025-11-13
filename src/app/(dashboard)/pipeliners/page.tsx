"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AwardIcon,
  FilterIcon,
  Loader2Icon,
  PartyPopperIcon,
  PencilIcon,
  RefreshCcwIcon,
  SparklesIcon,
  StarIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import CharityEventDialog from "@/components/charity/CharityEventDialog";
import EditPipelinerDialog from "@/components/pipeliners/EditPipelinerDialog";
import LogPipelinerEventDialog from "@/components/pipeliners/LogPipelinerEventDialog";
import PromoteToMemberDialog from "@/components/pipeliners/PromoteToMemberDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BUSINESS_MEETING_TARGET,
  CHARITY_EVENT_TARGET,
  getPipelinerBusinessMeetingCount,
  getPipelinerCharityEventCount,
  hasMetMembershipRequirements,
} from "@/lib/pipelinerEligibility";
import { useCharityEvents } from "@/hooks/useCharityEvents";
import { usePipeliners } from "@/hooks/usePipeliners";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { PipelinerEligibility } from "@/types/database";

type FilterOption = "all" | "eligible" | "not-eligible";

type MemberOption = {
  id: string;
  full_name: string;
  status: string | null;
};

type ProgressCircleProps = {
  label: string;
  current: number;
  total: number;
  accent: string;
  unitSingular?: string;
  unitPlural?: string;
};

function pluralizeUnit(
  value: number,
  singular?: string,
  plural?: string,
): string {
  if (!singular) return "";
  const normalizedPlural = plural ?? `${singular}s`;
  return value === 1 ? singular : normalizedPlural;
}

function ProgressCircle({
  label,
  current,
  total,
  accent,
  unitSingular,
  unitPlural,
}: ProgressCircleProps) {
  const safeTotal = total <= 0 ? 1 : total;
  const boundedCurrent = Math.min(Math.max(current, 0), safeTotal);
  const percentage = Math.min(boundedCurrent / safeTotal, 1);
  const angle = Math.round(percentage * 360);
  const summaryText = unitSingular
    ? `${Math.max(current, 0)} ${pluralizeUnit(
        Math.max(current, 0),
        unitSingular,
        unitPlural,
      )} out of ${total}`
    : `${Math.max(current, 0)}/${total}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
        style={{
          background: `conic-gradient(${accent} ${angle}deg, rgba(226, 232, 240, 0.9) ${angle}deg)`,
        }}
      >
        <div className="flex h-[70%] w-[70%] flex-col items-center justify-center rounded-full bg-white">
          <span className="text-base font-semibold text-slate-900">
            {Math.max(current, 0)}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            of {total}
          </span>
        </div>
      </div>
      <div className="text-center">
        <span className="block text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="block text-[11px] text-slate-500">{summaryText}</span>
      </div>
    </div>
  );
}

function formatProgressText(
  current: number,
  total: number,
  singular: string,
  plural?: string,
) {
  const normalizedCurrent = Math.max(current, 0);
  return `${normalizedCurrent} ${pluralizeUnit(
    normalizedCurrent,
    singular,
    plural,
  )} out of ${total}`;
}

export default function PipelinersPage() {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [search, setSearch] = useState("");
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [selectedPipeliner, setSelectedPipeliner] = useState<PipelinerEligibility | null>(
    null
  );
  const [charityDialogOpen, setCharityDialogOpen] = useState(false);
  const [logEventDialogOpen, setLogEventDialogOpen] = useState(false);
  const [eventPipeliner, setEventPipeliner] = useState<PipelinerEligibility | null>(null);
  const [editDialogPipeliner, setEditDialogPipeliner] = useState<PipelinerEligibility | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const {
    pipeliners,
    loading,
    error,
    promotingId,
    processingId,
    refresh: refreshPipeliners,
    promotePipelinerToMember,
    deletePipeliner,
  } = usePipeliners();

  const {
    events: charityEvents,
    loading: charityEventsLoading,
    creating: creatingEvent,
    createEvent,
  } = useCharityEvents();

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("members")
        .select("id, full_name, status")
        .order("full_name", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setMembers(
        (data ?? []).map((member) => ({
        id: member.id,
          full_name: member.full_name ?? "Unnamed Member",
          status: member.status ?? "active",
        }))
      );
    } catch (fetchError) {
      console.error("Failed to load members", fetchError);
      toast.error("Unable to load member directory for sponsorship insights.");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (!promotionDialogOpen) {
      setSelectedPipeliner(null);
    }
  }, [promotionDialogOpen]);

  useEffect(() => {
    if (!logEventDialogOpen) {
      setEventPipeliner(null);
    }
  }, [logEventDialogOpen]);

  const memberLookup = useMemo(() => {
    const dictionary = new Map<string, MemberOption>();
    members.forEach((member) => dictionary.set(member.id, member));
    return dictionary;
  }, [members]);

  const eligibleCount = useMemo(
    () =>
      pipeliners.filter((pipeliner) => {
        if (pipeliner.status === "became_member") {
          return false;
        }
        return (
          hasMetMembershipRequirements(pipeliner) ||
          pipeliner.is_eligible_for_membership === true
        );
      }).length,
    [pipeliners]
  );

  const activeCount = useMemo(
    () =>
      pipeliners.filter((pipeliner) => pipeliner.status === "active" || pipeliner.status === "eligible").length,
    [pipeliners]
  );

  const convertedCount = useMemo(
    () => pipeliners.filter((pipeliner) => pipeliner.status === "became_member").length,
    [pipeliners]
  );

  const filteredPipeliners = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return pipeliners.filter((pipeliner) => {
      const matchesSearch =
        !lowerSearch ||
        pipeliner.full_name.toLowerCase().includes(lowerSearch) ||
        (pipeliner.email ?? "").toLowerCase().includes(lowerSearch) ||
        (pipeliner.phone ?? "").toLowerCase().includes(lowerSearch);

      if (!matchesSearch) {
        return false;
      }

      const isEligible =
        pipeliner.status !== "became_member" &&
        (hasMetMembershipRequirements(pipeliner) ||
          pipeliner.is_eligible_for_membership === true);

      if (filter === "eligible") {
        return isEligible;
      }

      if (filter === "not-eligible") {
        return !isEligible && pipeliner.status !== "became_member";
      }

      return true;
    });
  }, [filter, pipeliners, search]);

  const recentCharityEvents = useMemo(() => charityEvents.slice(0, 5), [charityEvents]);

  const handleOpenPromotion = useCallback(
    (pipeliner: PipelinerEligibility) => {
      setSelectedPipeliner(pipeliner);
      setPromotionDialogOpen(true);
    },
    []
  );

  const handleOpenLogEvent = useCallback((pipeliner: PipelinerEligibility) => {
    setEventPipeliner(pipeliner);
    setLogEventDialogOpen(true);
  }, []);

  const handlePromote = useCallback(
    async (payload: { member_number: string; join_date: string }) => {
      if (!selectedPipeliner) return;
      await promotePipelinerToMember(selectedPipeliner.id, payload);
      await refreshPipeliners();
      toast.success("Pipeliner promoted to full member!");
    },
    [promotePipelinerToMember, refreshPipeliners, selectedPipeliner]
  );

  const handleDeletePipeliner = useCallback(
    async (pipeliner: PipelinerEligibility) => {
      const confirmed = window.confirm(
        `Remove ${pipeliner.full_name} from the pipeline? This action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      try {
        await deletePipeliner(pipeliner.id);
        toast.success("Pipeliner removed.");
      } catch (deleteError) {
        console.error("Failed to delete pipeliner", deleteError);
        toast.error(
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete pipeliner. Please try again."
        );
      }
    },
    [deletePipeliner]
  );

  const sponsorName = useCallback(
    (pipeliner: PipelinerEligibility) => {
      if (!pipeliner.sponsored_by) return "No sponsor captured";
      return memberLookup.get(pipeliner.sponsored_by)?.full_name ?? "Sponsor unknown";
    },
    [memberLookup]
  );

  const isPromoting = useMemo(
    () => (selectedPipeliner ? promotingId === selectedPipeliner.id : false),
    [promotingId, selectedPipeliner]
  );

  const pipelinerStatsReady = !loading && pipeliners.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Pipeliners
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
            Track pipeliner progress, celebrate milestones, and guide them toward full membership.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                void refreshPipeliners();
                toast.info("Refreshing pipeliner roster...");
              }}
            >
              <RefreshCcwIcon className="mr-2 size-4" />
              Refresh
            </Button>
            <Button onClick={() => setCharityDialogOpen(true)} disabled={membersLoading && pipeliners.length === 0}>
              <SparklesIcon className="mr-2 size-4" />
              Record Charity Event
        </Button>
          </div>
          {membersLoading ? (
            <p className="text-xs text-muted-foreground text-right">
              Fetching sponsor directory…
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Pipeliners
            </CardTitle>
            <UsersIcon className="size-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            {pipelinerStatsReady ? (
              <div className="text-3xl font-semibold text-slate-900">{activeCount}</div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Calculating...
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Total pipeline members still before promotion.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Promotion Ready
            </CardTitle>
            <StarIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {pipelinerStatsReady ? (
              <div className="text-3xl font-semibold text-emerald-600">{eligibleCount}</div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Calculating...
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Met the 3 business meetings and 1 charity event requirements.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Graduated to Members
            </CardTitle>
            <AwardIcon className="size-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            {pipelinerStatsReady ? (
              <div className="text-3xl font-semibold text-indigo-600">{convertedCount}</div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Calculating...
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Successfully promoted to full members.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <FilterIcon className="size-4 text-muted-foreground" />
              <div className="flex rounded-full border border-slate-200 bg-white p-1 text-xs font-medium text-muted-foreground">
                {(["all", "eligible", "not-eligible"] as FilterOption[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter(option)}
                    className={cn(
                      "rounded-full px-3 py-1 transition",
                      filter === option
                        ? "bg-slate-900 text-white"
                        : "hover:bg-slate-100"
                    )}
                  >
                    {option === "all"
                      ? "All"
                      : option === "eligible"
                      ? "Eligible Only"
                      : "Not Eligible"}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative md:w-72">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pipeliners..."
                className="pl-10"
              />
              <PartyPopperIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
                {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                />
                  ))
                ) : filteredPipeliners.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                No pipeliners match your filters yet. Try adjusting the filters or refreshing.
              </div>
                ) : (
                  filteredPipeliners.map((pipeliner) => {
                const businessMeetingsCompleted =
                  getPipelinerBusinessMeetingCount(pipeliner);
                const charityEventsCompleted =
                  getPipelinerCharityEventCount(pipeliner);
                const eligible =
                  pipeliner.status !== "became_member" &&
                  (hasMetMembershipRequirements(pipeliner) ||
                    pipeliner.is_eligible_for_membership === true);
                const sponsor = sponsorName(pipeliner);
                const statusLabel =
                  pipeliner.status === "became_member"
                    ? "Became Member"
                    : eligible
                    ? "Eligible for Membership"
                    : "Active";
                const statusBadgeClass =
                  pipeliner.status === "became_member"
                    ? "border-indigo-200 bg-indigo-100 text-indigo-700"
                    : eligible
                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-700";

                    return (
                  <Card
                    key={pipeliner.id}
                    className={cn(
                      "flex h-full flex-col justify-between border transition-all",
                      eligible
                        ? "border-emerald-200 shadow-lg shadow-emerald-100/60"
                        : pipeliner.status === "became_member"
                        ? "border-indigo-200"
                        : "border-slate-200"
                    )}
                  >
                    <CardHeader className="flex flex-col gap-3 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg font-semibold">
                            {pipeliner.full_name}
                          </CardTitle>
                          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                            <p>{pipeliner.email ?? "No email recorded"}</p>
                            <p>{pipeliner.phone ?? "No phone captured"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("border text-xs font-semibold", statusBadgeClass)}>
                            {statusLabel}
                          </Badge>
                          {pipeliner.status !== "became_member" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-rose-600"
                              onClick={() => handleDeletePipeliner(pipeliner)}
                              disabled={processingId === pipeliner.id}
                              aria-label={`Delete ${pipeliner.full_name}`}
                            >
                              {processingId === pipeliner.id ? (
                                <Loader2Icon className="size-4 animate-spin" />
                              ) : (
                                <TrashIcon className="size-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-slate-600">Sponsored by</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {sponsor}
                        </span>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <ProgressCircle
                          label="Business Meetings"
                          current={businessMeetingsCompleted}
                          total={BUSINESS_MEETING_TARGET}
                          accent="rgba(16, 185, 129, 0.85)"
                          unitSingular="meeting"
                          unitPlural="meetings"
                        />
                        <ProgressCircle
                          label="Charity Events"
                          current={charityEventsCompleted}
                          total={CHARITY_EVENT_TARGET}
                          accent="rgba(59, 130, 246, 0.85)"
                          unitSingular="charity event"
                          unitPlural="charity events"
                        />
                        </div>

                      <div className="mt-auto flex flex-col gap-3">
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>
                            Business meetings:{" "}
                            {formatProgressText(
                              businessMeetingsCompleted,
                              BUSINESS_MEETING_TARGET,
                              "meeting",
                              "meetings",
                            )}
                          </span>
                          <span>
                            Charity events:{" "}
                            {formatProgressText(
                              charityEventsCompleted,
                              CHARITY_EVENT_TARGET,
                              "charity event",
                              "charity events",
                            )}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenLogEvent(pipeliner)}
                            disabled={pipeliner.status === "became_member"}
                            className="border-slate-200"
                          >
                            <SparklesIcon className="mr-2 size-4" />
                            Log Event
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditDialogPipeliner(pipeliner)}
                            className="gap-2"
                          >
                            <PencilIcon className="size-4" />
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenPromotion(pipeliner)}
                            disabled={!eligible || pipeliner.status === "became_member"}
                            className="shadow"
                          >
                            {promotingId === pipeliner.id ? (
                              <>
                                <Loader2Icon className="mr-2 size-4 animate-spin" />
                                Promoting...
                              </>
                            ) : (
                              <>
                                <PartyPopperIcon className="mr-2 size-4" />
                                Promote to Member
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-none bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Celebration Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-200">
                Keep the momentum going by recognising milestones and planning the next charity initiative.
              </p>
              <Button
                variant="secondary"
                className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
                onClick={() => setCharityDialogOpen(true)}
              >
                <SparklesIcon className="mr-2 size-4" />
                Celebrate a Charity Win
              </Button>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-xs text-slate-200">
                Eligible pipeliners get a glowing frame. Promote them to trigger a confetti celebration and soundtrack for the whole team!
          </div>
        </CardContent>
      </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Recent Charity Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {charityEventsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
                  Loading recent events...
                </div>
              ) : recentCharityEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No charity events logged yet. Start the movement with your first event!
                </p>
              ) : (
                recentCharityEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-slate-700"
                  >
                    <p className="font-medium text-slate-900">{event.event_name}</p>
                    <p className="text-muted-foreground">
                      {new Date(event.event_date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {event.description ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PromoteToMemberDialog
        pipeliner={selectedPipeliner}
        open={promotionDialogOpen}
        onOpenChange={setPromotionDialogOpen}
        onPromote={handlePromote}
        promoting={isPromoting}
      />

      <CharityEventDialog
        open={charityDialogOpen}
        onOpenChange={setCharityDialogOpen}
        members={members.map((member) => ({
          id: member.id,
          label: member.full_name,
          type: "member" as const,
          subtitle: member.status === "inactive" ? "Inactive" : null,
        }))}
        pipeliners={pipeliners}
        onCreate={async (payload) => {
          await createEvent(payload);
        }}
        creating={creatingEvent}
      />

      <LogPipelinerEventDialog
        open={logEventDialogOpen}
        onOpenChange={setLogEventDialogOpen}
        pipeliner={eventPipeliner}
        creating={creatingEvent}
        onCreate={async ({ eventDate, eventName, notes, pipelinerId }) => {
          await createEvent({
            event_name: eventName,
            event_date: eventDate,
            description: notes || null,
            participant_pipeliner_ids: [pipelinerId],
          });
          await refreshPipeliners();
        }}
      />

      <EditPipelinerDialog
        pipeliner={editDialogPipeliner}
        members={members}
        open={Boolean(editDialogPipeliner)}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogPipeliner(null);
          }
        }}
        onUpdated={async () => {
          await refreshPipeliners();
          await fetchMembers();
        }}
        onLogNewEvent={
          editDialogPipeliner
            ? () => {
                setEventPipeliner(editDialogPipeliner);
                setLogEventDialogOpen(true);
              }
            : undefined
        }
      />
    </div>
  );
}



