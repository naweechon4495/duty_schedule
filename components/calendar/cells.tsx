"use client";

import { PhoneCall } from "lucide-react";
import type { DaySchedule, Leave, Nurse } from "@/lib/types";
import { SHIFT_DOT_CLASS, SHIFT_TONE_CLASS, ShiftChip } from "@/components/ui/badge";
import { dayGroups, personDayShifts, shortName } from "@/lib/domain/display";
import { LEAVE_TYPES } from "@/lib/domain/leave";
import type { ShiftTone } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

/** ช่องปฏิทินแบบรวมทุกคน: เดสก์ท็อปแสดงชื่อ, แท็บเล็ตแสดงจำนวนคนต่อกะ */
export function AllCell({
  ds,
  nurseById,
  filter,
  tones,
  mode = "auto",
}: {
  mode?: "auto" | "names";
  ds: DaySchedule | undefined;
  nurseById: Map<string, Nurse>;
  filter?: (id: string) => boolean;
  tones?: Set<string>;
}) {
  if (!ds) return <span className="text-[11px] text-ink-mute">ยังไม่จัดเวร</span>;
  const oncall = new Set(ds.night_oncall || []);
  const groups = dayGroups(ds)
    .filter((g) => !tones || tones.has(g.tone))
    .map((g) => ({ ...g, ids: filter ? g.ids.filter(filter) : g.ids }))
    .filter((g) => g.ids.length);
  if (!groups.length) return <span className="text-[11px] text-ink-mute">—</span>;
  return (
    <>
      <div className={mode === "names" ? "space-y-1" : "hidden space-y-0.5 xl:block"}>
        {groups.map((g) => (
          <div key={g.slot} className={cn("flex items-start gap-1 leading-snug", mode === "names" ? "text-sm" : "text-[11px]")}>
            <span className={cn("shrink-0 rounded-full", mode === "names" ? "mt-[7px] size-2" : "mt-[5px] size-1.5", SHIFT_DOT_CLASS[g.tone])} />
            <span className={cn("min-w-0 text-ink-soft", mode === "auto" && "line-clamp-2")}>
              <span className="font-semibold text-ink">{g.short}</span>{" "}
              {g.ids.map((id) => shortName(nurseById.get(id)?.name || "?") + (g.slot === "night" && oncall.has(id) ? "📞" : "")).join(", ")}
            </span>
          </div>
        ))}
      </div>
      <div className={mode === "names" ? "hidden" : "flex flex-wrap gap-1 xl:hidden"}>
        {groups.map((g) => (
          <span key={g.slot} className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
            <span className={cn("size-1.5 rounded-full", SHIFT_DOT_CLASS[g.tone])} />
            {g.short}
            <span className="font-semibold text-ink">{g.ids.length}</span>
          </span>
        ))}
      </div>
    </>
  );
}

/** ช่องปฏิทินของคนเดียว: ชิปกะ / ลา / เช้าทำการ / หยุด */
export function PersonCell({ ds, personId, leave, workday }: { ds: DaySchedule | undefined; personId: string; leave?: Leave; workday: boolean }) {
  const shifts = personDayShifts(ds, personId);
  return (
    <div className="flex flex-wrap gap-1">
      {leave && <ShiftChip tone="leave">{LEAVE_TYPES[leave.type] || "ลา"}</ShiftChip>}
      {shifts.map((s, i) => (
        <ShiftChip key={i} tone={s.tone}>
          {s.label}
          {s.oncall && <PhoneCall />}
        </ShiftChip>
      ))}
      {!leave && !shifts.length &&
        (workday ? (
          <span className="rounded-md border border-dashed border-line px-1.5 py-0.5 text-[11px] text-ink-soft">เช้าทำการ</span>
        ) : (
          <span className="text-[11px] font-semibold text-ink-mute">หยุด</span>
        ))}
    </div>
  );
}

function MiniChip({ tone, children }: { tone: ShiftTone; children: React.ReactNode }) {
  return (
    <span className={cn("flex items-center justify-center gap-px truncate rounded px-0.5 text-xs leading-4 font-semibold max-[359px]:text-[10px] [&_svg]:size-2.5 [&_svg]:shrink-0", SHIFT_TONE_CLASS[tone])}>
      {children}
    </span>
  );
}

/** ช่องปฏิทินเดือนบนมือถือ (คนเดียว): ป้ายกะสั้น ๆ ซ้อนกันในช่องแคบ */
export function PersonMiniCell({ ds, personId, leave }: { ds: DaySchedule | undefined; personId: string; leave?: Leave }) {
  const shifts = personDayShifts(ds, personId);
  if (!leave && !shifts.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {leave && <MiniChip tone="leave">ลา</MiniChip>}
      {shifts.map((s, i) => (
        <MiniChip key={i} tone={s.tone}>
          {s.short}
          {s.oncall && <PhoneCall />}
        </MiniChip>
      ))}
    </div>
  );
}

export function ShiftLegend({ className }: { className?: string }) {
  const items: [keyof typeof SHIFT_DOT_CLASS, string][] = [
    ["morning", "เช้า (วันหยุด)"],
    ["afternoon", "บ่าย"],
    ["night", "ดึก"],
    ["preop", "Pre-op"],
    ["custom", "เวรกำหนดเอง"],
    ["leave", "ลา"],
  ];
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft", className)}>
      {items.map(([t, l]) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", SHIFT_DOT_CLASS[t])} />
          {l}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <PhoneCall className="size-3" /> ดึก On call
      </span>
    </div>
  );
}
