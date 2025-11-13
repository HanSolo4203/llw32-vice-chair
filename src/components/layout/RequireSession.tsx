"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type RequireSessionProps = {
  children: ReactNode;
};

export function RequireSession({ children }: RequireSessionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = getSupabaseBrowserClient();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const redirectToLogin = () => {
      if (!active) return;
      const params = new URLSearchParams();
      if (pathname) {
        params.set("redirectedFrom", pathname);
      }
      router.replace(`/login${params.size > 0 ? `?${params.toString()}` : ""}`);
    };

    const handleSession = (session: Session | null) => {
      if (!active) return;
      if (session) {
        setChecking(false);
      } else {
        redirectToLogin();
      }
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      handleSession(session);
    };

    void checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2Icon className="size-4 animate-spin" />
          Checking session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

