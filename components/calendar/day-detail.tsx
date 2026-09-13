"use client";

import { Phone, PhoneCall, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { GenBadge, SHIFT_DOT_CLASS, ShiftChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/client/api";
import { dateTH } from "@/lib/domain/dates";
import { dayGroups } from "@/lib/domain/display";
import { getDay, isOnLeave } from "@/lib/domain/schedule";
import { LEAVE_TYPES } from "@/lib/domain/leave";
import { cn } from "@/lib/utils";

/** รายละเอียดเวรของวัน — แอดมินแก้ไขได้ในหน้าต่างเดียวกัน */
export function DayDetail({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { schedule, nurses, nurseById, cal, me, leaves, mutate } = useNurseData();
  const [adding, setAdding] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  if (!date) return null;

  const isAdmin = me.role === "admin";
  const ds = getDay(schedule, date);
  const off = cal.isOffDay(date);
  const relevant = off
    ? ["morning1", "morning2", "afternoon1", "afternoon2", "night", "preop_morning", "preop_afternoon"]
    : ["afternoon1", "afternoon2", "night", "preop"];
  const groups = dayGroups(ds, { includeEmpty: isAdmin ? relevant : [] });
  const oncall = new Set(ds?.night_oncall || []);
  const onLeaveToday = leaves.filter((l) => l.status === "approved" && date >= l.dateFrom && date <= l.dateTo);

  const edit = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true);
    await mutate(() => api("/api/schedule/day", { body: { date, ...body } }), ok);
    setBusy(false);
  };

  const people = nurses
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
    .map((n) => ({ value: n.id, label: `${n.code} ${n.name}`, hint: `รุ่น ${n.generation}${isOnLeave(leaves, n.id, date) ? " · ลาวันนี้" : ""}` }));

  const title = dateTH(date, true);
  const sub = cal.holidayName(date) || (off ? "วันหยุดสุดสัปดาห์" : "วันทำการ");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} description={sub} side="right" size="lg">
      {!ds && (
        <div className="space-y-3">
          <Alert tone="warn">ยังไม่ได้จัดเวรในวันนี้</Alert>
          {isAdmin && (
            <Button variant="secondary" loading={busy} onClick={() => edit({ op: "create" }, "สร้างวันว่างแล้ว")}>
              <Plus /> สร้างวันว่างเพื่อแก้ไขเอง
            </Button>
          )}
        </div>
      )}

      {onLeaveToday.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {onLeaveToday.map((l) => (
            <ShiftChip key={l.id} tone="leave">
              {LEAVE_TYPES[l.type]}: {nurseById.get(l.nurseId)?.name || "?"}
            </ShiftChip>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.slot} className="rounded-xl border border-line">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className={cn("size-2.5 rounded-full", SHIFT_DOT_CLASS[g.tone])} />
              <h3 className="flex-1 text-sm font-bold text-ink">{g.label}</h3>
              <span className="text-xs text-ink-mute">{g.ids.length} คน</span>
              {isAdmin && g.customKey && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="ลบเวรนี้"
                  onClick={() => edit({ op: "remove_custom", key: g.customKey }, "ลบเวรกำหนดเองแล้ว")}
                >
                  <Trash2 className="text-rose-600" />
                </Button>
              )}
            </header>
            <ul className="divide-y divide-line">
              {g.ids.length === 0 && <li className="px-3 py-3 text-sm text-ink-mute">— ยังไม่มีคน —</li>}
              {g.ids.map((id) => {
                const n = nurseById.get(id);
                const isOc = g.slot === "night" && oncall.has(id);
                return (
                  <li key={id} className={cn("flex min-h-14 items-center gap-2 px-3 py-2", isOc && "bg-amber-50")}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-ink">{n?.name || "ไม่พบข้อมูล (" + id + ")"}</span>
                        {n && <GenBadge gen={n.generation} />}
                        {isOc && (
                          <ShiftChip tone="morning">
                            <PhoneCall /> On call
                          </ShiftChip>
                        )}
                      </div>
                      <div className="text-xs text-ink-mute">{n?.code}</div>
                    </div>
                    {n?.phone && (
                      <a href={`tel:${n.phone}`} className="grid size-10 place-items-center rounded-full text-brand-700 hover:bg-brand-50" aria-label={`โทรหา ${n.name}`}>
                        <Phone className="size-4" />
                      </a>
                    )}
                    {isAdmin && !g.customKey && (
                      <>
                        {g.slot === "night" && (
                          <Button size="icon-sm" variant="ghost" disabled={busy} aria-label="สลับ On call" onClick={() => edit({ op: "toggle_oncall", nurseId: id })}>
                            <PhoneCall className={isOc ? "text-amber-600" : ""} />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" disabled={busy} aria-label="เอาออกจากกะนี้" onClick={() => edit({ op: "remove", slot: g.slot, nurseId: id })}>
                          <X className="text-rose-600" />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {isAdmin && !g.customKey && ds && (
              <div className="border-t border-line p-2">
                {adding === g.slot ? (
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Combobox items={people} value={pick} onChange={setPick} placeholder="เลือกพยาบาล..." />
                    </div>
                    <Button
                      disabled={!pick}
                      loading={busy}
                      onClick={async () => {
                        await edit({ op: "add", slot: g.slot, nurseId: pick });
                        setAdding(null);
                        setPick("");
                      }}
                    >
                      เพิ่ม
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="ยกเลิก" onClick={() => setAdding(null)}>
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="w-full text-brand-700" onClick={() => { setAdding(g.slot); setPick(""); }}>
                    <Plus /> เพิ่มคนในกะนี้
                  </Button>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
