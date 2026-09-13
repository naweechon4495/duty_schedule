"use client";

import { WEEKDAY_SHORT_TH, dateStrOf, daysInMonth, todayStr, weekdayOf } from "@/lib/domain/dates";
import type { HolidayCalendar } from "@/lib/domain/holidays";
import { cn } from "@/lib/utils";

/**
 * ตารางเดือนแบบกริด 7 คอลัมน์ — เนื้อหาในช่องกำหนดผ่าน renderCell
 * ใช้บนแท็บเล็ต/เดสก์ท็อป (มือถือใช้ Agenda แทน)
 */
export function MonthGrid({
  month,
  cal,
  renderCell,
  onSelect,
  cellClassName,
  minCellHeight = "min-h-28",
}: {
  month: string;
  cal: HolidayCalendar;
  renderCell: (dateStr: string) => React.ReactNode;
  onSelect?: (dateStr: string) => void;
  cellClassName?: (dateStr: string) => string | undefined;
  minCellHeight?: string;
}) {
  const days = daysInMonth(month);
  const lead = weekdayOf(dateStrOf(month, 1));
  const today = todayStr();
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAY_SHORT_TH.map((w, i) => (
        <div key={w} className={cn("py-1.5 text-center text-xs font-bold", i === 0 || i === 6 ? "text-rose-600" : "text-ink-soft")}>
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={"e" + i} />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const dateStr = dateStrOf(month, i + 1);
        const hol = cal.isHoliday(dateStr);
        const off = cal.isOffDay(dateStr);
        const isToday = dateStr === today;
        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelect?.(dateStr)}
            className={cn(
              "flex flex-col items-stretch rounded-xl border p-1.5 text-left transition-[border,box-shadow] hover:border-brand-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/20",
              minCellHeight,
              off ? "border-rose-100 bg-rose-50/40" : "border-line bg-surface",
              hol && "border-amber-200 bg-amber-50/60",
              isToday && "border-brand-600 ring-2 ring-brand-600/20",
              cellClassName?.(dateStr),
            )}
          >
            <div className="mb-1 flex items-center gap-1">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs font-bold",
                  isToday ? "bg-brand-600 text-white" : off ? "text-rose-600" : "text-ink",
                )}
              >
                {i + 1}
              </span>
              {hol && <span className="truncate text-[10px] font-semibold text-amber-800">{cal.holidayName(dateStr)}</span>}
            </div>
            <div className="min-w-0 flex-1">{renderCell(dateStr)}</div>
          </button>
        );
      })}
    </div>
  );
}
