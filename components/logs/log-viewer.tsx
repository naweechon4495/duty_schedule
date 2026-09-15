"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  CalendarCog,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  History,
  LogIn,
  LogOut,
  Pencil,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  WandSparkles,
  X,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { dateTimeTH, fmtLocal } from "@/lib/domain/dates";
import { FIELD_LABELS } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export const ACTIONS: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  create: { label: "เพิ่ม", icon: FilePlus2, cls: "bg-emerald-100 text-emerald-800" },
  update: { label: "แก้ไข", icon: Pencil, cls: "bg-sky-100 text-sky-800" },
  delete: { label: "ลบ", icon: Trash2, cls: "bg-rose-100 text-rose-800" },
  approve: { label: "อนุมัติ", icon: Check, cls: "bg-emerald-100 text-emerald-800" },
  reject: { label: "ปฏิเสธ", icon: X, cls: "bg-rose-100 text-rose-800" },
  login: { label: "เข้าระบบ", icon: LogIn, cls: "bg-slate-100 text-slate-700" },
  logout: { label: "ออกระบบ", icon: LogOut, cls: "bg-slate-100 text-slate-700" },
  login_failed: { label: "รหัสผิด", icon: ShieldAlert, cls: "bg-amber-100 text-amber-900" },
  auto_schedule: { label: "จัดเวร", icon: WandSparkles, cls: "bg-brand-100 text-brand-800" },
  clear: { label: "ล้างตาราง", icon: RotateCcw, cls: "bg-rose-100 text-rose-800" },
  snapshot: { label: "บันทึกสำรอง", icon: Archive, cls: "bg-teal-100 text-teal-800" },
  restore: { label: "กู้คืนตาราง", icon: ArchiveRestore, cls: "bg-amber-100 text-amber-900" },
  import: { label: "นำเข้า", icon: Upload, cls: "bg-violet-100 text-violet-800" },
  export: { label: "ส่งออก", icon: Download, cls: "bg-slate-100 text-slate-700" },
  reset_password: { label: "ตั้งรหัสใหม่", icon: KeyRound, cls: "bg-amber-100 text-amber-900" },
};

const ENTITY_LABELS: Record<string, string> = {
  nurse: "พยาบาล",
  assistant: "ผู้ช่วยพยาบาล",
  schedule: "ตารางเวร",
  schedule_snapshot: "สำรองตารางเวร",
  swap: "แลกเวร",
  leave: "วันลา",
  holiday: "วันหยุด",
  user: "ผู้ใช้",
  session: "การเข้าระบบ",
  data: "ข้อมูลทั้งหมด",
};

const ENTITY_ICONS: Record<string, LucideIcon> = { swap: ArrowLeftRight, schedule: CalendarCog, schedule_snapshot: Archive };

interface LogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  actors: { username: string; fullname: string }[];
}

function rangeFor(preset: string): { from?: string; to?: string } {
  const today = new Date();
  const back = (d: number) => fmtLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - d));
  if (preset === "today") return { from: back(0) };
  if (preset === "7d") return { from: back(6) };
  if (preset === "30d") return { from: back(29) };
  return {};
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** หน้า Log ใช้ร่วมกันทั้งระบบพยาบาลและ NA */
export function LogViewer({ endpoint }: { endpoint: string }) {
  const params = useSearchParams();
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState(params.get("entity") || "");
  const [entityId, setEntityId] = useState(params.get("entityId") || "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = preset === "custom" ? { from: from || undefined, to: to || undefined } : rangeFor(preset);
    const sp = new URLSearchParams();
    Object.entries({ ...r, actor, action, entity, entityId, q, page: String(page) }).forEach(([k, v]) => v && sp.set(k, v));
    try {
      setData(await api<LogResponse>(`${endpoint}?${sp}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลด Log ไม่สำเร็จ");
    }
    setLoading(false);
  }, [endpoint, preset, from, to, actor, action, entity, entityId, q, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  // จัดกลุ่มตามวัน (มือถือ)
  const byDay = new Map<string, AuditEntry[]>();
  data?.entries.forEach((e) => {
    const day = new Date(e.at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    byDay.set(day, [...(byDay.get(day) || []), e]);
  });

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
          <div className="relative col-span-2">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
            <Input value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="ค้นหาในรายละเอียด เช่น ชื่อ รหัส" className="pl-9" />
          </div>
          <Select value={preset} onChange={(e) => resetPage(setPreset)(e.target.value)} aria-label="ช่วงเวลา">
            <option value="today">วันนี้</option>
            <option value="7d">7 วันล่าสุด</option>
            <option value="30d">30 วันล่าสุด</option>
            <option value="all">ทั้งหมด</option>
            <option value="custom">กำหนดเอง</option>
          </Select>
          <Select value={actor} onChange={(e) => resetPage(setActor)(e.target.value)} aria-label="ผู้ทำ">
            <option value="">ทุกคน</option>
            {data?.actors.map((a) => (
              <option key={a.username} value={a.username}>
                {a.fullname || a.username}
              </option>
            ))}
          </Select>
          <Select value={action} onChange={(e) => resetPage(setAction)(e.target.value)} aria-label="การกระทำ">
            <option value="">ทุกการกระทำ</option>
            {Object.entries(ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select
            value={entity}
            onChange={(e) => {
              resetPage(setEntity)(e.target.value);
              setEntityId("");
            }}
            aria-label="ประเภทข้อมูล"
          >
            <option value="">ทุกประเภทข้อมูล</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} aria-label="ตั้งแต่" />
              <Input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} aria-label="ถึง" />
            </>
          )}
        </div>
        {entityId && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
            <History className="size-4" /> แสดงเฉพาะประวัติของรายการที่เลือก
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEntityId("")}>
              ดูทั้งหมด
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>{loading ? "กำลังโหลด..." : data ? `${data.total.toLocaleString("th-TH")} รายการ` : ""}</span>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <Button size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="หน้าก่อน">
                <ChevronLeft />
              </Button>
              <span className="px-2">
                {page}/{pages}
              </span>
              <Button size="icon-sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="หน้าถัดไป">
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        {data && data.entries.length === 0 && <EmptyState icon={<History />} title="ไม่พบ Log ตามเงื่อนไข" />}

        {data && data.entries.length > 0 && (
          <>
            {/* Desktop/Tablet */}
            <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">เวลา</th>
                    <th className="px-3 py-2.5 text-left font-semibold">ผู้ทำ</th>
                    <th className="px-3 py-2.5 text-left font-semibold">การกระทำ</th>
                    <th className="px-3 py-2.5 text-left font-semibold">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.entries.map((e) => {
                    const a = ACTIONS[e.action] || { label: e.action, icon: History, cls: "bg-slate-100" };
                    return (
                      <tr key={e.id} className="cursor-pointer hover:bg-canvas/60" onClick={() => setDetail(e)}>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{dateTimeTH(e.at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="max-w-40 truncate font-medium text-ink">{e.actorName || e.actor || "—"}</div>
                          <div className="hidden text-xs text-ink-mute lg:block">{e.actor}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={a.cls}>
                            <a.icon /> {a.label}
                          </Badge>
                          <div className="mt-0.5 text-xs text-ink-mute">{ENTITY_LABELS[e.entity] || e.entity}</div>
                        </td>
                        <td className="px-3 py-2.5 text-ink">{e.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="space-y-4 md:hidden">
              {[...byDay.entries()].map(([day, list]) => (
                <div key={day}>
                  <div className="mb-1.5 text-xs font-bold text-ink-mute">{day}</div>
                  <div className="divide-y divide-line rounded-xl border border-line">
                    {list.map((e) => {
                      const a = ACTIONS[e.action] || { label: e.action, icon: ENTITY_ICONS[e.entity] || History, cls: "bg-slate-100" };
                      return (
                        <button key={e.id} className="flex w-full gap-3 p-3 text-left active:bg-canvas" onClick={() => setDetail(e)}>
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4", a.cls)}>
                            <a.icon />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-ink">{e.summary}</span>
                            <span className="mt-0.5 block text-xs text-ink-mute">
                              {new Date(e.at).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} · {e.actorName || e.actor || "—"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
      {detail && <LogDetail entry={detail} onClose={() => setDetail(null)} />}
    </Card>
  );
}

function LogDetail({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const a = ACTIONS[entry.action] || { label: entry.action, icon: History, cls: "bg-slate-100" };
  const before = (entry.before && typeof entry.before === "object" && !Array.isArray(entry.before) ? entry.before : null) as Record<string, unknown> | null;
  const after = (entry.after && typeof entry.after === "object" && !Array.isArray(entry.after) ? entry.after : null) as Record<string, unknown> | null;
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const showTable = entry.action === "update" && keys.length > 0 && keys.length <= 20;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="รายละเอียด Log" description={dateTimeTH(entry.at)} side="right">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={a.cls}>
            <a.icon /> {a.label}
          </Badge>
          <Badge className="bg-slate-100 text-slate-700">{ENTITY_LABELS[entry.entity] || entry.entity}</Badge>
        </div>
        <p className="text-[15px] leading-relaxed text-ink">{entry.summary}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-ink-soft">ผู้ทำ</dt>
          <dd className="text-ink">
            {entry.actorName || "—"} {entry.actor && <span className="text-ink-mute">({entry.actor})</span>}
          </dd>
          {entry.entityId && (
            <>
              <dt className="text-ink-soft">รหัสรายการ</dt>
              <dd className="break-all text-ink">{entry.entityId}</dd>
            </>
          )}
        </dl>
        {showTable ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ฟิลด์</th>
                  <th className="px-3 py-2 text-left font-semibold">ค่าเดิม</th>
                  <th className="px-3 py-2 text-left font-semibold">ค่าใหม่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.map((k) => (
                  <tr key={k} className="align-top">
                    <td className="px-3 py-2 font-medium whitespace-nowrap text-ink">{FIELD_LABELS[k] || k}</td>
                    <td className="px-3 py-2 break-all text-rose-800">{fmtVal(before?.[k])}</td>
                    <td className="px-3 py-2 break-all text-emerald-800">{fmtVal(after?.[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          (entry.before != null || entry.after != null) && (
            <details className="rounded-xl border border-line">
              <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink">ข้อมูลเต็ม (สำหรับตรวจสอบ)</summary>
              <pre className="max-h-80 overflow-auto border-t border-line bg-canvas p-3 text-xs">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
            </details>
          )
        )}
      </div>
    </Dialog>
  );
}
