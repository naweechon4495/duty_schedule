"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { makeHolidayCalendar, type HolidayCalendar } from "@/lib/domain/holidays";
import { matchNurse } from "@/lib/domain/schedule";
import type { BootstrapData, Nurse } from "@/lib/types";
import { toast } from "@/components/ui/toast";

interface NurseDataContext extends BootstrapData {
  cal: HolidayCalendar;
  nurseById: Map<string, Nurse>;
  myNurse: Nurse | null;
  refresh: () => Promise<void>;
  /**
   * เรียก API แก้ข้อมูล → แจ้งผล → โหลดข้อมูลล่าสุดจากเซิร์ฟเวอร์
   * คืน true ถ้าสำเร็จ (ข้อผิดพลาดแสดงเป็น toast ให้แล้ว)
   */
  mutate: (fn: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
  nurseName: (id: string) => string;
}

const Ctx = createContext<NurseDataContext | null>(null);

export function useNurseData(): NurseDataContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNurseData ต้องอยู่ใน NurseDataProvider");
  return v;
}

export function NurseDataProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        setData(await api<BootstrapData>("/api/bootstrap", { loginPath: "/login" }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, []);

  useEffect(() => {
    refresh();
    // กลับมาที่แท็บนี้ → ดึงข้อมูลล่าสุด (เห็นสิ่งที่คนอื่นแก้ระหว่างนั้น)
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const mutate = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      try {
        const r = (await fn()) as { warning?: string } | undefined;
        if (r && typeof r === "object" && r.warning) toast.warn(r.warning);
        else if (successMessage) toast.success(successMessage);
        await refresh();
        return true;
      } catch (e) {
        toast.error(e instanceof ApiError || e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
        if (e instanceof ApiError && e.status === 409) refresh();
        return false;
      }
    },
    [refresh],
  );

  const value = useMemo<NurseDataContext | null>(() => {
    if (!data) return null;
    const nurseById = new Map(data.nurses.map((n) => [n.id, n]));
    return {
      ...data,
      cal: makeHolidayCalendar(data.holidays),
      nurseById,
      myNurse: matchNurse(data.nurses, data.me),
      refresh,
      mutate,
      nurseName: (id: string) => nurseById.get(id)?.name || "?",
    };
  }, [data, refresh, mutate]);

  if (!value) {
    if (error)
      return (
        <div className="grid min-h-dvh place-items-center p-6 text-center">
          <div>
            <p className="font-semibold text-ink">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="mt-1 text-sm text-ink-soft">{error}</p>
            <button onClick={refresh} className="mt-4 h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white">
              ลองใหม่
            </button>
          </div>
        </div>
      );
    return <>{fallback}</>;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
