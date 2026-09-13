"use client";

import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  CalendarOff,
  History,
  House,
  Palmtree,
  Settings,
  Stethoscope,
  UserCog,
  Users,
  WandSparkles,
} from "lucide-react";
import { useMemo } from "react";
import { NurseDataProvider, useNurseData } from "@/components/data/nurse-data";
import { ConfirmHost } from "@/components/ui/confirm";
import { api } from "@/lib/client/api";
import { ROLE_LABELS, canSee } from "@/lib/domain/roles";
import { AppShell, type NavItem } from "./app-shell";

export const NurseLogo = () => (
  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
    <Stethoscope className="size-5" />
  </span>
);

function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-ink-soft">
        <NurseLogo />
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full w-1/3 animate-[slide-left_1s_ease-in-out_infinite_alternate] rounded-full bg-brand-600" />
        </div>
        <span className="text-sm">กำลังโหลดข้อมูล...</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, swaps, leaves } = useNurseData();
  const nav = useMemo<NavItem[]>(() => {
    const approver = me.role === "admin" || me.role === "approver";
    const pendingSwaps = approver ? swaps.filter((s) => s.status === "pending").length : 0;
    const pendingLeaves = approver ? leaves.filter((l) => l.status === "pending").length : 0;
    const items: (NavItem & { page: string })[] = [
      { page: "home", href: "/", label: "หน้าแรก", icon: House, group: "ตารางเวร", mobile: true },
      { page: "calendar", href: "/calendar", label: "ปฏิทิน", icon: CalendarDays, group: "ตารางเวร", mobile: true },
      { page: "schedule", href: "/schedule", label: "จัดเวร", icon: WandSparkles, group: "ตารางเวร" },
      { page: "swap", href: "/swap", label: "แลกเวร", icon: ArrowLeftRight, group: "คำขอ", badge: pendingSwaps, mobile: true },
      { page: "leave", href: "/leave", label: "วันลา", icon: Palmtree, group: "คำขอ", badge: pendingLeaves },
      { page: "stats", href: "/stats", label: "สถิติ", icon: BarChart3, group: "รายงาน" },
      { page: "nurses", href: "/nurses", label: "พยาบาล", icon: Users, group: "จัดการ" },
      { page: "holidays", href: "/holidays", label: "วันหยุด", icon: CalendarOff, group: "จัดการ" },
      { page: "users", href: "/users", label: "ผู้ใช้", icon: UserCog, group: "จัดการ" },
      { page: "logs", href: "/logs", label: "Log", icon: History, group: "จัดการ" },
      { page: "settings", href: "/settings", label: "ตั้งค่า", icon: Settings, group: "จัดการ" },
    ];
    return items.filter((i) => canSee(me.role, i.page));
  }, [me.role, swaps, leaves]);

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <AppShell
      title="ระบบจัดเวรพยาบาล"
      subtitle="โรงพยาบาลลำพูน"
      logo={<NurseLogo />}
      nav={nav}
      user={{ fullname: me.fullname, roleLabel: ROLE_LABELS[me.role] }}
      onLogout={logout}
    >
      {children}
      <ConfirmHost />
    </AppShell>
  );
}

export function NurseAppShell({ children }: { children: React.ReactNode }) {
  return (
    <NurseDataProvider fallback={<LoadingScreen />}>
      <Shell>{children}</Shell>
    </NurseDataProvider>
  );
}

/** กันหน้าที่บทบาทนี้ไม่มีสิทธิ์ (เซิร์ฟเวอร์กันซ้ำอีกชั้นที่ API) */
export function RequirePage({ page, children }: { page: string; children: React.ReactNode }) {
  const { me } = useNurseData();
  if (!canSee(me.role, page))
    return (
      <div className="grid min-h-[50dvh] place-items-center text-center">
        <div>
          <p className="text-lg font-bold text-ink">ไม่มีสิทธิ์เข้าหน้านี้</p>
          <p className="mt-1 text-sm text-ink-soft">หน้านี้สำหรับบทบาทอื่น หากต้องการใช้งานกรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  return <>{children}</>;
}
