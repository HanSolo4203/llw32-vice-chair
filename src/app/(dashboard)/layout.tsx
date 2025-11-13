import type { ReactNode } from "react";

import { AppSidebar, MobileNav } from "@/components/layout/AppSidebar";
import { RequireSession } from "@/components/layout/RequireSession";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <div className="flex-1 pb-20 lg:pb-0">{children}</div>
          <MobileNav />
        </div>
      </div>
    </RequireSession>
  );
}

