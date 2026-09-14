"use client";

import { WEEKDAY_SHORT_TH, dateStrOf, daysInMonth, todayStr, weekdayOf } from "@/lib/domain/dates";
import type { HolidayCalendar } from "@/lib/domain/holidays";
import { cn } from "@/lib/utils";

/**
 * ตารางเดือนแบบกริด 7 คอลัมน์ — เนื้อหาในช่องกำหนดผ่าน renderCell
 * compact = ขนาดมือถือ: ช่องแคบ ไม่แสดงชื่อวันหยุดในช่อง (แสดงเป็นรายการใต้ตารางแทน)
 */
export function MonthGrid({
  month,
  cal,
  renderCell,
  onSelect,
  cellClassName,
  minCellHeight = "min-h-28",
  compact,
}: {
  month: string;
  cal: HolidayCalendar;
  renderCell: (dateStr: string) => React.ReactNode;
  onSelect?: (dateStr: string) => void;
  cellClassName?: (dateStr: string) => string | undefined;
  minCellHeight?: string;
  compact?: boolean;
}) {
  const days = daysInMonth(month);
  const lead = weekdayOf(dateStrOf(month, 1));
  const today = todayStr();
  const holidays = compact ? Array.from({ length: days }, (_, i) => dateStrOf(month, i + 1)).filter((d) => cal.isHoliday(d)) : [];
  return (
    <div className={cn("grid grid-cols-7", compact ? "gap-1" : "gap-1.5")}>
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
              "flex min-w-0 flex-col items-stretch border text-left transition-[border,box-shadow] hover:border-brand-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/20",
              compact ? "rounded-lg p-0.5 pb-1" : "rounded-xl p-1.5",
              minCellHeight,
              off ? "border-rose-100 bg-rose-50/40" : "border-line bg-surface",
              hol && "border-amber-200 bg-amber-50/60",
              isToday && "border-brand-600 ring-2 ring-brand-600/20",
              cellClassName?.(dateStr),
            )}
          >
            <div className={cn("flex items-center gap-1", compact ? "mb-0.5 justify-center" : "mb-1")}>
              <span
                className={cn(
                  "grid place-items-center rounded-full font-bold",
                  compact ? "size-5 text-[11px]" : "size-6 text-xs",
                  isToday ? "bg-brand-600 text-white" : off ? "text-rose-600" : "text-ink",
                )}
              >
                {i + 1}
              </span>
              {hol && !compact && <span className="truncate text-[10px] font-semibold text-amber-800">{cal.holidayName(dateStr)}</span>}
            </div>
            <div className="min-w-0 flex-1">{renderCell(dateStr)}</div>
          </button>
        );
      })}
      {holidays.length > 0 && (
        <ul className="col-span-7 mt-1 space-y-0.5 text-xs text-amber-800">
          {holidays.map((d) => (
            <li key={d} className="flex gap-1.5">
              <span className="font-bold">{Number(d.slice(8))}</span>
              {cal.holidayName(d)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
