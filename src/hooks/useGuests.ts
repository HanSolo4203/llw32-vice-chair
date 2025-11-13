"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  Database,
  Guest,
  GuestInsert,
  GuestMeetingCounts,
  GuestUpdate,
  PipelinerInsert,
} from "@/types/database";

export type GuestFormValues = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  invited_by?: string | null;
  first_attendance?: string | null;
  status?: Guest["status"];
  notes?: string | null;
};

export type PromoteGuestToPipelinerPayload = {
  sponsoring_member_id: string;
  notes?: string | null;
};

type UseGuestsState = {
  guests: GuestMeetingCounts[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  updatingId: string | null;
  deletingId: string | null;
  promotingId: string | null;
};

const initialState: UseGuestsState = {
  guests: [],
  loading: true,
  error: null,
  creating: false,
  updatingId: null,
  deletingId: null,
  promotingId: null,
};

function normalizeGuestPayload(values: GuestFormValues): GuestInsert {
  return {
    full_name: values.full_name.trim(),
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    invited_by: values.invited_by || null,
    first_attendance: values.first_attendance || null,
    status: values.status ?? "active",
    notes: values.notes?.trim() || null,
  };
}

export function useGuests() {
  const [state, setState] = useState<UseGuestsState>(initialState);

  const setPartialState = useCallback(
    (
      partial:
        | Partial<UseGuestsState>
        | ((previous: UseGuestsState) => Partial<UseGuestsState>),
    ) => {
      setState((previous) => ({
        ...previous,
        ...(typeof partial === "function" ? partial(previous) : partial),
      }));
    },
    [],
  );

  const fetchGuests = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("guest_meeting_counts")
          .select("*")
          .order("meeting_count", { ascending: false })
          .order("full_name", { ascending: true })
          .returns<GuestMeetingCounts[]>();

        if (error) {
          throw error;
        }

        const filteredGuests = (data ?? []).filter(
          (guest) => guest.status !== "became_pipeliner"
        );

        setPartialState({
          guests: filteredGuests,
          error: null,
        });
      } catch (error) {
        console.error("Failed to fetch guests", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load guests right now.",
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [setPartialState]
  );

  const createGuest = useCallback(
    async (values: GuestFormValues) => {
      setPartialState({ creating: true, error: null });

      try {
        const payload = normalizeGuestPayload(values);

        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("guests")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await fetchGuests({ silently: true });
        return data as Guest;
      } catch (error) {
        console.error("Failed to create guest", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to create guest. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ creating: false });
      }
    },
    [fetchGuests, setPartialState]
  );

  const updateGuest = useCallback(
    async (id: string, values: GuestFormValues) => {
      setPartialState({ updatingId: id, error: null });

      try {
        const payload: GuestUpdate = normalizeGuestPayload(values);

        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("guests")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await fetchGuests({ silently: true });
        return data as Guest;
      } catch (error) {
        console.error("Failed to update guest", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to update guest. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ updatingId: null });
      }
    },
    [fetchGuests, setPartialState]
  );

  const deleteGuest = useCallback(
    async (id: string) => {
      setPartialState({ deletingId: id, error: null });

      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("guests").delete().eq("id", id);

        if (error) {
          throw error;
        }

        setPartialState((previous) => ({
          guests: previous.guests.filter((guest) => guest.id !== id),
        }));
      } catch (error) {
        console.error("Failed to delete guest", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to delete guest. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ deletingId: null });
      }
    },
    [setPartialState]
  );

  const promoteGuestToPipeliner = useCallback(
    async (guestId: string, payload: PromoteGuestToPipelinerPayload) => {
      const guest = state.guests.find((item) => item.id === guestId);
      if (!guest) {
        throw new Error("Guest not found.");
      }

      const isEligible =
        guest.meeting_count >= 3 || guest.eligible_for_pipeliner === true;
      if (!isEligible) {
        throw new Error("Guest is not yet eligible to become a pipeliner.");
      }

      if (!payload.sponsoring_member_id) {
        throw new Error("Sponsoring member is required.");
      }

      setPartialState({ promotingId: guestId, error: null });

      try {
        const supabase = getSupabaseBrowserClient();
        const pipelinerPayload: PipelinerInsert = {
          full_name: guest.full_name,
          email: guest.email ?? null,
          phone: guest.phone ?? null,
          promoted_from_guest_date: new Date().toISOString().split("T")[0],
          guest_meetings_count: Math.max(guest.meeting_count, 3),
          business_meetings_count: guest.present_count ?? guest.meeting_count,
          charity_events_count: guest.event_count ?? 0,
          is_eligible_for_membership: false,
          status: "active",
          sponsored_by: payload.sponsoring_member_id,
          notes: payload.notes?.trim() || null,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("pipeliners")
          .insert(pipelinerPayload)
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        const { error: guestUpdateError } = await supabase
          .from("guests")
          .update({
            status: "became_pipeliner",
            total_meetings: Math.max(guest.total_meetings ?? 0, guest.meeting_count),
          })
          .eq("id", guest.id);

        if (guestUpdateError) {
          if (inserted?.id) {
            await supabase.from("pipeliners").delete().eq("id", inserted.id);
          }
          throw guestUpdateError;
        }

        await fetchGuests({ silently: true });

        return inserted;
      } catch (error) {
        console.error("Failed to promote guest to pipeliner", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to promote guest right now.",
        });
        throw error;
      } finally {
        setPartialState({ promotingId: null });
      }
    },
    [fetchGuests, setPartialState, state.guests]
  );

  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient<Database> | null = null;

    void fetchGuests();

    try {
      supabaseInstance = getSupabaseBrowserClient();
      const handleRealtimeUpdate = () => {
        if (isMounted) {
          void fetchGuests({ silently: true });
        }
      };

      channel = supabaseInstance
        .channel("guests-live-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "guests" },
          handleRealtimeUpdate
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance" },
          handleRealtimeUpdate
        )
        .subscribe();
    } catch (error) {
      console.error("Failed to subscribe to guest updates", error);
      setPartialState({
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe to guest updates.",
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseInstance) {
        supabaseInstance.removeChannel(channel);
      }
    };
  }, [fetchGuests, setPartialState]);

  const guestsById = useMemo(() => {
    const map = new Map<string, GuestMeetingCounts>();
    state.guests.forEach((guest) => map.set(guest.id, guest));
    return map;
  }, [state.guests]);

  return useMemo(
    () => ({
      guests: state.guests,
      guestsById,
      loading: state.loading,
      error: state.error,
      creating: state.creating,
      updatingId: state.updatingId,
      deletingId: state.deletingId,
      promotingId: state.promotingId,
      refresh: () => fetchGuests(),
      createGuest,
      updateGuest,
      deleteGuest,
      promoteGuestToPipeliner,
    }),
    [
      createGuest,
      deleteGuest,
      fetchGuests,
      guestsById,
      promoteGuestToPipeliner,
      state.creating,
      state.deletingId,
      state.error,
      state.guests,
      state.loading,
      state.promotingId,
      state.updatingId,
      updateGuest,
    ]
  );
}


