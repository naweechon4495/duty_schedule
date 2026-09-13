"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { makeHolidayCalendar, type HolidayCalendar } from "@/lib/domain/holidays";
import { matchAssistant } from "@/lib/domain/na";
import type { Assistant, NABootstrapData } from "@/lib/types";
import { toast } from "@/components/ui/toast";

interface NADataContext extends NABootstrapData {
  cal: HolidayCalendar;
  byId: Map<string, Assistant>;
  mine: Assistant | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  mutate: (fn: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
  name: (id: string) => string;
}

const Ctx = createContext<NADataContext | null>(null);

export function useNAData(): NADataContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNAData ต้องอยู่ใน NADataProvider");
  return v;
}

export function NADataProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [data, setData] = useState<NABootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        setData(await api<NABootstrapData>("/api/na/bootstrap", { loginPath: "/na/login" }));
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
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const mutate = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      try {
        const r = (await fn()) as { warning?: string } | undefined;
        if (r?.warning) toast.warn(r.warning);
        else if (successMessage) toast.success(successMessage);
        await refresh();
        return true;
      } catch (e) {
        toast.error(e instanceof ApiError || e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
        return false;
      }
    },
    [refresh],
  );

  const value = useMemo<NADataContext | null>(() => {
    if (!data) return null;
    const byId = new Map(data.assistants.map((a) => [a.id, a]));
    return {
      ...data,
      cal: makeHolidayCalendar(data.holidays),
      byId,
      mine: matchAssistant(data.assistants, data.me),
      isAdmin: data.me.role === "naadmin",
      refresh,
      mutate,
      name: (id: string) => byId.get(id)?.name || "?",
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
