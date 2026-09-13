"use client";

import { ArrowLeftRight, BarChart3, CalendarDays, HandHeart, History, House, Palmtree, UserCog, Users, WandSparkles } from "lucide-react";
import { useEffect, useMemo } from "react";
import { NADataProvider, useNAData } from "@/components/data/na-data";
import { ConfirmHost } from "@/components/ui/confirm";
import { api } from "@/lib/client/api";
import { NA_ROLE_LABELS } from "@/lib/domain/roles";
import { AppShell, type NavItem } from "./app-shell";

export const NALogo = () => (
  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
    <HandHeart className="size-5" />
  </span>
);

function Shell({ children }: { children: React.ReactNode }) {
  const { me, swaps, leaves, isAdmin } = useNAData();
  const nav = useMemo<NavItem[]>(() => {
    const items: (NavItem & { admin?: boolean })[] = [
      { href: "/na", label: "หน้าแรก", icon: House, group: "ตารางเวร", mobile: true },
      { href: "/na/calendar", label: "ปฏิทิน", icon: CalendarDays, group: "ตารางเวร", mobile: true },
      { href: "/na/schedule", label: "จัดเวร", icon: WandSparkles, group: "ตารางเวร", admin: true },
      { href: "/na/swap", label: "แลกเวร", icon: ArrowLeftRight, group: "คำขอ", mobile: true, badge: isAdmin ? swaps.filter((s) => s.status === "pending").length : 0 },
      { href: "/na/leave", label: "วันลา", icon: Palmtree, group: "คำขอ", badge: isAdmin ? leaves.filter((l) => l.status === "pending").length : 0 },
      { href: "/na/stats", label: "สถิติ", icon: BarChart3, group: "รายงาน" },
      { href: "/na/assistants", label: "รายชื่อ NA", icon: Users, group: "จัดการ", admin: true },
      { href: "/na/users", label: "ผู้ใช้", icon: UserCog, group: "จัดการ", admin: true },
      { href: "/na/logs", label: "Log", icon: History, group: "จัดการ", admin: true },
    ];
    return items.filter((i) => !i.admin || isAdmin);
  }, [isAdmin, swaps, leaves]);

  const logout = async () => {
    try {
      await api("/api/na/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/na/login";
    }
  };

  return (
    <AppShell
      title="ระบบจัดเวรผู้ช่วยพยาบาล"
      subtitle="NA · โรงพยาบาลลำพูน"
      logo={<NALogo />}
      nav={nav}
      user={{ fullname: me.fullname, roleLabel: NA_ROLE_LABELS[me.role] }}
      onLogout={logout}
      basePath="/na"
    >
      {children}
      <ConfirmHost />
    </AppShell>
  );
}

/** ใส่ธีมเขียวที่ <html> ด้วย เพื่อให้ dialog/toast ที่ render นอก tree (portal) เป็นสีเดียวกัน */
export function NATheme() {
  useEffect(() => {
    document.documentElement.classList.add("theme-na");
    return () => document.documentElement.classList.remove("theme-na");
  }, []);
  return null;
}

export function NAAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-na">
      <NATheme />
      <NADataProvider
        fallback={
          <div className="grid min-h-dvh place-items-center text-sm text-ink-soft">
            <div className="flex flex-col items-center gap-3">
              <NALogo /> กำลังโหลดข้อมูล...
            </div>
          </div>
        }
      >
        <Shell>{children}</Shell>
      </NADataProvider>
    </div>
  );
}

export function RequireNAAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useNAData();
  if (!isAdmin)
    return (
      <div className="grid min-h-[50dvh] place-items-center text-center">
        <p className="text-lg font-bold text-ink">หน้านี้สำหรับผู้ดูแลระบบ NA</p>
      </div>
    );
  return <>{children}</>;
}
