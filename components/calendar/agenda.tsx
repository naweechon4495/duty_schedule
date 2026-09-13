"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { WEEKDAY_TH, dateStrOf, daysInMonth, todayStr, weekdayOf } from "@/lib/domain/dates";
import type { HolidayCalendar } from "@/lib/domain/holidays";
import { cn } from "@/lib/utils";

/** มุมมองรายวันสำหรับมือถือ — เลื่อนไปวันนี้อัตโนมัติ */
export function Agenda({
  month,
  cal,
  renderDay,
  onSelect,
  hideEmpty,
  isEmpty,
}: {
  month: string;
  cal: HolidayCalendar;
  renderDay: (dateStr: string) => React.ReactNode;
  onSelect?: (dateStr: string) => void;
  hideEmpty?: boolean;
  isEmpty?: (dateStr: string) => boolean;
}) {
  const today = todayStr();
  const todayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "center" });
  }, [month]);
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => dateStrOf(month, i + 1)).filter((d) => !(hideEmpty && isEmpty?.(d)));
  return (
    <div className="space-y-2">
      {days.map((dateStr) => {
        const off = cal.isOffDay(dateStr);
        const hol = cal.holidayName(dateStr);
        const isToday = dateStr === today;
        const w = weekdayOf(dateStr);
        return (
          <button
            key={dateStr}
            ref={isToday ? todayRef : undefined}
            type="button"
            onClick={() => onSelect?.(dateStr)}
            className={cn(
              "flex w-full items-stretch gap-3 rounded-xl border bg-surface p-3 text-left active:bg-canvas",
              isToday ? "border-brand-600 ring-2 ring-brand-600/15" : "border-line",
            )}
          >
            <div className={cn("flex w-12 shrink-0 flex-col items-center justify-center rounded-lg py-1", off ? "bg-rose-50 text-rose-700" : "bg-canvas text-ink")}>
              <span className="text-xs font-semibold">{WEEKDAY_TH[w].slice(0, 2)}</span>
              <span className="text-xl leading-tight font-bold">{Number(dateStr.slice(8))}</span>
            </div>
            <div className="min-w-0 flex-1 self-center">
              {(hol || isToday) && (
                <div className="mb-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                  {isToday && <span className="text-brand-700">วันนี้</span>}
                  {hol && <span className="text-amber-800">{hol}</span>}
                </div>
              )}
              {renderDay(dateStr)}
            </div>
            <ChevronRight className="size-5 shrink-0 self-center text-ink-mute" />
          </button>
        );
      })}
    </div>
  );
}
