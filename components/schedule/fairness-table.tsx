"use client";

import type { MonthSchedule, Nurse } from "@/lib/types";
import { GenBadge } from "@/components/ui/badge";
import { GENERATIONS, GEN_LABELS, countMonth } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

/** สรุปจำนวนเวรต่อคนแยกตามรุ่น — ใช้ตรวจความเท่าเทียมก่อนบันทึกตาราง */
export function FairnessTable({ ms, nurses }: { ms: MonthSchedule; nurses: Nurse[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {GENERATIONS.map((g) => {
        const list = nurses
          .filter((n) => n.generation === g)
          .map((n) => ({ n, c: countMonth(ms, n.id) }))
          .sort((a, b) => b.c.total - a.c.total || a.n.code.localeCompare(b.n.code, "th", { numeric: true }));
        if (!list.length) return null;
        const totals = list.map((x) => x.c.total);
        const max = Math.max(...totals);
        const min = Math.min(...totals);
        return (
          <div key={g} className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-2">
              <GenBadge gen={g} />
              <span className="text-sm text-ink-soft">{list.length} คน</span>
              <span className={cn("ml-auto text-sm font-semibold", max - min > 3 ? "text-amber-700" : "text-emerald-700")}>
                {min === max ? `ทุกคน ${max} เวร` : `${min}–${max} เวร`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-mute">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">ชื่อ</th>
                    <th className="px-2 py-1.5 font-semibold">รวม</th>
                    {g !== "4" && <th className="px-2 py-1.5 font-semibold">เช้า</th>}
                    {g !== "4" && <th className="px-2 py-1.5 font-semibold">บ่าย</th>}
                    {g !== "4" && <th className="px-2 py-1.5 font-semibold">ดึก</th>}
                    {g === "4" && <th className="px-2 py-1.5 font-semibold">Pre-op</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map(({ n, c }) => (
                    <tr key={n.id}>
                      <td className="max-w-48 truncate px-3 py-1.5" title={n.name}>
                        {n.name}
                      </td>
                      <td className={cn("px-2 py-1.5 text-center font-bold", c.total === max && max !== min && "text-amber-700", c.total === min && max !== min && "text-sky-700")}>
                        {c.total}
                      </td>
                      {g !== "4" && <td className="px-2 py-1.5 text-center">{c.morning}</td>}
                      {g !== "4" && <td className="px-2 py-1.5 text-center">{c.afternoon}</td>}
                      {g !== "4" && <td className="px-2 py-1.5 text-center">{c.night}</td>}
                      {g === "4" && <td className="px-2 py-1.5 text-center">{c.preop}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-ink-mute lg:col-span-2">
        {GEN_LABELS["1"]}-{GEN_LABELS["3"]}: ทีมละ 3 คนต้องคนละรุ่น รุ่นที่มีคนน้อยจึงได้เวรต่อคนมากกว่า — ความเท่ากันวัดภายในรุ่นเดียวกัน
      </p>
    </div>
  );
}
