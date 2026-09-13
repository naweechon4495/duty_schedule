"use client";

import { Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { Button } from "@/components/ui/button";
import { WEEKDAY_TH, currentMonthKey, dateStrOf, daysInMonth, monthTitleTH, weekdayOf } from "@/lib/domain/dates";
import { dayGroups } from "@/lib/domain/display";

/** หน้าพิมพ์ตารางเวร (สั่งพิมพ์หรือบันทึกเป็น PDF จากเบราว์เซอร์ — ภาษาไทยแสดงถูกต้อง) */
export default function PrintSchedulePage() {
  const params = useSearchParams();
  const month = params.get("month") || currentMonthKey();
  const { schedule, nurseById, cal } = useNurseData();
  const ms = schedule[month] || {};
  const names = (ids: string[]) => ids.map((id) => nurseById.get(id)?.name || "?").join(", ") || "-";

  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-white">
      <div className="no-print mb-4 flex items-center gap-2">
        <Button onClick={() => window.print()}>
          <Printer /> พิมพ์ / บันทึก PDF
        </Button>
        <span className="text-sm text-ink-soft">แนะนำ: ตั้งค่าหน้ากระดาษแนวนอน (Landscape)</span>
      </div>
      <h1 className="text-lg font-bold">ตารางเวรพยาบาล โรงพยาบาลลำพูน — {monthTitleTH(month)}</h1>
      <table className="mt-3 w-full border-collapse text-[11px] leading-snug print:text-[9px]">
        <thead>
          <tr className="bg-slate-100">
            {["วันที่", "วัน", "เช้า", "บ่าย", "ดึก", "Pre-op", "อื่น ๆ"].map((h) => (
              <th key={h} className="border border-slate-300 px-1.5 py-1 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: daysInMonth(month) }, (_, i) => {
            const date = dateStrOf(month, i + 1);
            const ds = ms[i + 1];
            const groups = dayGroups(ds);
            const pick = (tone: string) => groups.filter((g) => g.tone === tone);
            const oc = new Set(ds?.night_oncall || []);
            return (
              <tr key={date} className={cal.isOffDay(date) ? "bg-rose-50 print:bg-slate-100" : ""}>
                <td className="border border-slate-300 px-1.5 py-1 text-center">{i + 1}</td>
                <td className="border border-slate-300 px-1.5 py-1 whitespace-nowrap">
                  {WEEKDAY_TH[weekdayOf(date)]}
                  {cal.isHoliday(date) && <div className="text-[9px] text-amber-800">{cal.holidayName(date)}</div>}
                </td>
                {["morning", "afternoon"].map((t) => (
                  <td key={t} className="border border-slate-300 px-1.5 py-1">
                    {pick(t).map((g) => (
                      <div key={g.slot}>
                        <b>{g.short}</b> {names(g.ids)}
                      </div>
                    ))}
                  </td>
                ))}
                <td className="border border-slate-300 px-1.5 py-1">
                  {(ds?.night || []).map((id) => (nurseById.get(id)?.name || "?") + (oc.has(id) ? " (On call)" : "")).join(", ")}
                </td>
                <td className="border border-slate-300 px-1.5 py-1">
                  {pick("preop").map((g) => (
                    <div key={g.slot}>{names(g.ids)}</div>
                  ))}
                </td>
                <td className="border border-slate-300 px-1.5 py-1">
                  {pick("custom").map((g) => (
                    <div key={g.slot}>
                      <b>{g.label}</b> {names(g.ids)}
                    </div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
