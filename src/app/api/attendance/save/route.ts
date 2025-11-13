import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Pool, type PoolClient } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import type { Attendance, Database } from "@/types/database";

type AttendancePayload = {
  meetingId: string;
  meetingType?: string | null;
  upserts?: Array<{
    id?: string | null;
    meeting_id: string;
    member_id?: string | null;
    guest_id?: string | null;
    pipeliner_id?: string | null;
    status: Attendance["status"];
  }>;
  deletions?: string[];
};

type UpsertRow = {
  id: string;
  member_id: string | null;
  guest_id: string | null;
  pipeliner_id: string | null;
  status: Attendance["status"];
};

let pool: Pool | null = null;
let serviceClient: SupabaseClient<Database, any, any, any> | null = null;

function getConnectionString() {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? null;
}

function getPool() {
  if (!pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error("Database connection string is not configured.");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_TOKEN ??
    null
  );
}

function hasSupabaseServiceConfiguration() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getServiceRoleKey());
}

function getSupabaseServiceClient(): SupabaseClient<Database, any, any, any> {
  if (!serviceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = getServiceRoleKey();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase service role configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or equivalent).",
      );
    }

    serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serviceClient;
}

function normalizeUpsertPayload(
  upserts: NonNullable<AttendancePayload["upserts"]>,
) {
  return upserts.map((entry) => {
    const { id, ...rest } = entry;
    return id ? { id, ...rest } : rest;
  });
}

async function saveAttendanceWithSupabaseClient<
  Client extends SupabaseClient<Database, any, any, any>,
>(
  supabase: Client,
  upserts: NonNullable<AttendancePayload["upserts"]>,
  deletions: string[],
) {
  const sanitizedUpserts = normalizeUpsertPayload(upserts);

  if (deletions.length > 0) {
    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .in("id", deletions);
    if (deleteError) throw deleteError;
  }

  let upsertRows: UpsertRow[] = [];

  if (sanitizedUpserts.length > 0) {
    const { data, error: upsertError } = await supabase
      .from("attendance")
      .upsert(sanitizedUpserts, { onConflict: "id" })
      .select("id, member_id, guest_id, pipeliner_id, status");

    if (upsertError) throw upsertError;
    if (Array.isArray(data)) {
      upsertRows = data as UpsertRow[];
    }
  }

  return {
    records: upsertRows,
    deletedIds: deletions,
  };
}

async function saveWithSupabaseService(
  upserts: NonNullable<AttendancePayload["upserts"]>,
  deletions: string[],
) {
  const supabase = getSupabaseServiceClient();
  return saveAttendanceWithSupabaseClient(supabase, upserts, deletions);
}

async function saveWithSupabaseAuthClient(
  upserts: NonNullable<AttendancePayload["upserts"]>,
  deletions: string[],
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.delete({ name, ...options });
        },
      },
    },
  );
  return saveAttendanceWithSupabaseClient(supabase, upserts, deletions);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as AttendancePayload;

  if (!payload?.meetingId) {
    return NextResponse.json(
      { success: false, error: "meetingId is required." },
      { status: 400 },
    );
  }

  const upserts = Array.isArray(payload.upserts) ? payload.upserts : [];
  const deletions = Array.isArray(payload.deletions) ? payload.deletions : [];

  const connectionString = getConnectionString();
  const hasServiceClient = hasSupabaseServiceConfiguration();

  if (connectionString) {
    let client: PoolClient | null = null;
    try {
      client = await getPool().connect();
      await client.query("BEGIN");

      if (deletions.length > 0) {
        await client.query(
          "DELETE FROM attendance WHERE id = ANY($1::uuid[])",
          [deletions],
        );
      }

      let upsertRows: UpsertRow[] = [];

      if (upserts.length > 0) {
        const { rows } = await client.query<UpsertRow>(
          `
            with payload as (
              select
                nullif(value->>'id', '')::uuid as id,
                (value->>'meeting_id')::uuid as meeting_id,
                nullif(value->>'member_id', '')::uuid as member_id,
                nullif(value->>'guest_id', '')::uuid as guest_id,
                nullif(value->>'pipeliner_id', '')::uuid as pipeliner_id,
                value->>'status' as status
              from jsonb_array_elements($1::jsonb) as value
            ),
            normalized as (
              select
                coalesce(id, gen_random_uuid()) as id,
                meeting_id,
                member_id,
                guest_id,
                pipeliner_id,
                status
              from payload
            ),
            upserted as (
              insert into attendance (id, meeting_id, member_id, guest_id, pipeliner_id, status)
              select
                normalized.id,
                normalized.meeting_id,
                normalized.member_id,
                normalized.guest_id,
                normalized.pipeliner_id,
                normalized.status
              from normalized
              on conflict (id) do update
                set status = excluded.status
              returning id, member_id, guest_id, pipeliner_id, status
            )
            select id, member_id, guest_id, pipeliner_id, status
            from upserted;
          `,
          [JSON.stringify(upserts)],
        );
        upsertRows = rows ?? [];
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        records: upsertRows,
        deletedIds: deletions,
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK");
      }
      console.error("Attendance batch save failed", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while saving attendance.",
        },
        { status: 500 },
      );
    } finally {
      client?.release();
    }
  }

  if (hasServiceClient) {
    try {
      const result = await saveWithSupabaseService(upserts, deletions);
      return NextResponse.json({
        success: true,
        records: result.records,
        deletedIds: result.deletedIds,
      });
    } catch (error) {
      console.error("Attendance batch save failed via Supabase service client", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while saving attendance.",
        },
        { status: 500 },
      );
    }
  }

  try {
    const result = await saveWithSupabaseAuthClient(upserts, deletions);
    return NextResponse.json({
      success: true,
      records: result.records,
      deletedIds: result.deletedIds,
    });
  } catch (error) {
    console.error("Attendance batch save failed via authenticated Supabase client", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Database access is not configured on the server. Set SUPABASE_DB_URL (or DATABASE_URL) or provide Supabase credentials.",
      },
      { status: 500 },
    );
  }
}


