"use client";

import { type ComponentType, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LogOut,
  Rocket,
  Settings,
  Users,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { toast } from "sonner";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const MembershipReportIcon: ComponentType<{ className?: string }> = ({ className }) => (
  <span className={cn("text-lg", className)}>👥</span>
);

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Meetings", href: "/meetings", icon: CalendarDays },
  { label: "Members", href: "/members", icon: Users },
  { label: "Guests", href: "/guests", icon: UserPlus },
  { label: "Pipeliners", href: "/pipeliners", icon: Rocket },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Membership Report", href: "/reports/membership", icon: MembershipReportIcon },
  { label: "Projects Report", href: "/reports/projects", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActivePath(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error("Failed to sign out. Please try again.");
      setLoggingOut(false);
      return;
    }

    toast.success("Signed out successfully.");
    router.replace("/login");
    setLoggingOut(false);
  };

  return (
    <aside className="relative hidden shrink-0 border-r border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100/80 px-4 pb-8 pt-6 shadow-sm backdrop-blur print:hidden lg:sticky lg:top-0 lg:block lg:min-h-screen lg:w-64 lg:pl-5 lg:pr-6 lg:pt-8 lg:pb-10 xl:w-72">
      <div className="flex items-center gap-3 px-1">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-semibold text-white shadow-md shadow-blue-500/30">
          RTL
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Round Table Lilongwe 32</p>
          <p className="text-xs text-slate-500">Membership control center</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/40"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <Icon className={cn("size-4 transition", active ? "text-white" : "text-slate-400 group-hover:text-blue-600")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-xs text-blue-800 shadow-sm">
        <p className="font-semibold">Friendly tip</p>
        <p className="mt-1 leading-relaxed">
          Use the dashboard to monitor attendance momentum before every meeting.
        </p>
      </div>

      <Button
        variant="ghost"
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-6 w-full gap-2 rounded-xl border border-transparent bg-white/80 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
      >
        <LogOut className="size-4" />
        {loggingOut ? "Signing out…" : "Sign out"}
      </Button>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error("Failed to sign out. Please try again.");
      setLoggingOut(false);
      return;
    }

    toast.success("Signed out successfully.");
    router.replace("/login");
    setLoggingOut(false);
  };

  return (
    <nav className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/90 shadow-[0_-6px_24px_-16px_rgba(15,23,42,0.35)] backdrop-blur print:hidden lg:hidden">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-1 overflow-x-auto px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item);

          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(
                "flex-1 flex-col gap-1 rounded-xl px-2 py-2 text-[11px] font-medium",
                active ? "bg-blue-600/10 text-blue-600" : "text-slate-500"
              )}
            >
              <Link href={item.href}>
                <Icon className={cn("size-4", active ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </Link>
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex-1 flex-col gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-slate-500"
        >
          <LogOut className="size-4 text-slate-400" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </nav>
  );
}


