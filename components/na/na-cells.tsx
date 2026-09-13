"use client";

import type { Assistant, DaySchedule, NALeave } from "@/lib/types";
import { SHIFT_DOT_CLASS, ShiftChip } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { dateTH } from "@/lib/domain/dates";
import { shortName } from "@/lib/domain/display";
import type { HolidayCalendar } from "@/lib/domain/holidays";
import { LEAVE_TYPES } from "@/lib/domain/leave";
import { NA_SHIFTS, NA_SHIFT_LABELS, NA_SHIFT_TONE } from "@/lib/domain/na";
import { cn } from "@/lib/utils";

export function NAAllCell({ ds, byId, mode = "auto" }: { ds: DaySchedule | undefined; byId: Map<string, Assistant>; mode?: "auto" | "names" }) {
  if (!ds) return <span className="text-[11px] text-ink-mute">ยังไม่จัดเวร</span>;
  const groups = NA_SHIFTS.filter((k) => (ds[k] || []).length);
  if (!groups.length) return <span className="text-[11px] text-ink-mute">—</span>;
  return (
    <div className={cn(mode === "names" ? "space-y-1 text-sm" : "space-y-0.5 text-[11px]")}>
      {groups.map((k) => (
        <div key={k} className="flex items-start gap-1 leading-snug">
          <span className={cn("mt-[6px] size-1.5 shrink-0 rounded-full", SHIFT_DOT_CLASS[NA_SHIFT_TONE[k]])} />
          <span className={cn("min-w-0 text-ink-soft", mode === "auto" && "line-clamp-2")}>
            <span className="font-semibold text-ink">{NA_SHIFT_LABELS[k]}</span> {(ds[k] || []).map((id) => shortName(byId.get(id)?.name || "?")).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function NAPersonCell({ ds, id, leave }: { ds: DaySchedule | undefined; id: string; leave?: NALeave }) {
  const shifts = ds ? NA_SHIFTS.filter((k) => (ds[k] || []).includes(id)) : [];
  return (
    <div className="flex flex-wrap gap-1">
      {leave && <ShiftChip tone="leave">{LEAVE_TYPES[leave.type] || "ลา"}</ShiftChip>}
      {shifts.map((k) => (
        <ShiftChip key={k} tone={NA_SHIFT_TONE[k]}>
          {NA_SHIFT_LABELS[k]}
        </ShiftChip>
      ))}
      {!leave && !shifts.length && <span className="text-[11px] font-semibold text-ink-mute">หยุด</span>}
    </div>
  );
}

export function NADayDetail({
  date,
  ds,
  byId,
  cal,
  leaves,
  onClose,
}: {
  date: string;
  ds: DaySchedule | undefined;
  byId: Map<string, Assistant>;
  cal: HolidayCalendar;
  leaves: NALeave[];
  onClose: () => void;
}) {
  const onLeave = leaves.filter((l) => l.status === "approved" && date >= l.dateFrom && date <= l.dateTo);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={dateTH(date, true)} description={cal.holidayName(date) || (cal.isOffDay(date) ? "วันหยุดสุดสัปดาห์" : "วันทำการ")} side="right">
      {!ds && <p className="text-sm text-ink-soft">ยังไม่ได้จัดเวรในวันนี้</p>}
      {onLeave.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {onLeave.map((l) => (
            <ShiftChip key={l.id} tone="leave">
              {LEAVE_TYPES[l.type]}: {byId.get(l.assistantId)?.name}
            </ShiftChip>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {ds &&
          NA_SHIFTS.filter((k) => (ds[k] || []).length).map((k) => (
            <section key={k} className="rounded-xl border border-line">
              <header className="flex items-center gap-2 border-b border-line px-3 py-2">
                <span className={cn("size-2.5 rounded-full", SHIFT_DOT_CLASS[NA_SHIFT_TONE[k]])} />
                <h3 className="flex-1 text-sm font-bold">{NA_SHIFT_LABELS[k]}</h3>
                <span className="text-xs text-ink-mute">{ds[k].length} คน</span>
              </header>
              <ul className="divide-y divide-line">
                {ds[k].map((id) => {
                  const a = byId.get(id);
                  return (
                    <li key={id} className="flex min-h-12 items-center gap-2 px-3 py-2">
                      <span className="flex-1 font-semibold">{a?.name || id}</span>
                      <span className="text-xs text-ink-mute">{a?.code}</span>
                      {a?.phone && (
                        <a href={`tel:${a.phone}`} className="text-sm font-semibold text-brand-700">
                          โทร
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
    </Dialog>
  );
}
