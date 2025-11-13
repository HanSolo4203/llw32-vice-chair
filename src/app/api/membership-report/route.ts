import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";
import { fetchMembershipStats } from "@/lib/membershipStats";
import { generateAISummary } from "@/lib/generateAISummary";

let serviceClient: SupabaseClient<Database, any, any, any> | null = null;

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_TOKEN ??
    null
  );
}

async function getSupabaseServerClient(): Promise<
  SupabaseClient<Database, any, any, any>
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getServiceRoleKey();

  if (supabaseUrl && serviceRoleKey) {
    if (!serviceClient) {
      serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return serviceClient;
  }

  if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
}

export async function POST(request: Request) {
  try {
    const { month, ideas } = (await request.json()) as {
      month?: string;
      ideas?: string | null;
    };

    if (!month) {
      return NextResponse.json(
        { error: "month is required." },
        { status: 400 },
      );
    }

    const supabase = await getSupabaseServerClient();
    const stats = await fetchMembershipStats(supabase, month);
    if ((stats.pipelinerAttendanceRate ?? 0) < 0) {
      stats.pipelinerAttendanceRate = 0;
    }
    const summary = await generateAISummary(stats, ideas);

    return NextResponse.json({ stats, summary });
  } catch (error) {
    console.error("Failed to generate membership report", error);

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    const status = message.includes("Invalid month") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}


