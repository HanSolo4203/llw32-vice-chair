import type { PipelinerEligibility } from "@/types/database";

export const BUSINESS_MEETING_TARGET = 6;
export const CHARITY_EVENT_TARGET = 1;

export function getPipelinerBusinessMeetingCount(
  pipeliner: PipelinerEligibility,
): number {
  const recordedBusinessMeetings = pipeliner.business_meetings_count ?? pipeliner.meeting_count;
  const guestMeetings = pipeliner.guest_meetings_count ?? 0;

  if (recordedBusinessMeetings != null && recordedBusinessMeetings > 0) {
    return recordedBusinessMeetings;
  }

  return guestMeetings;
}

export function getPipelinerCharityEventCount(
  pipeliner: PipelinerEligibility,
): number {
  return (
    pipeliner.charity_events_count ??
    pipeliner.charity_event_count ??
    0
  );
}

export function hasMetMembershipRequirements(
  pipeliner: PipelinerEligibility,
): boolean {
  return (
    getPipelinerBusinessMeetingCount(pipeliner) >= BUSINESS_MEETING_TARGET &&
    getPipelinerCharityEventCount(pipeliner) >= CHARITY_EVENT_TARGET
  );
}

