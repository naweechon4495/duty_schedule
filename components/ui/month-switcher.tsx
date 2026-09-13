"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, currentMonthKey, monthTitleTH } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

/** เลือกเดือน: ◀ ชื่อเดือน ▶ + ปุ่มกลับเดือนนี้ (กดชื่อเดือนเพื่อเลือกจากปฏิทินเดือน) */
export function MonthSwitcher({ value, onChange, className }: { value: string; onChange: (m: string) => void; className?: string }) {
  const isCurrent = value === currentMonthKey();
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, -1))}
        className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-soft hover:bg-canvas"
        aria-label="เดือนก่อนหน้า"
      >
        <ChevronLeft className="size-5" />
      </button>
      <label className="relative flex h-11 min-w-36 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface px-3 text-[15px] font-semibold text-ink hover:bg-canvas">
        {monthTitleTH(value)}
        <input
          type="month"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="เลือกเดือน"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, 1))}
        className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-soft hover:bg-canvas"
        aria-label="เดือนถัดไป"
      >
        <ChevronRight className="size-5" />
      </button>
      {!isCurrent && (
        <button type="button" onClick={() => onChange(currentMonthKey())} className="ml-1 h-11 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          เดือนนี้
        </button>
      )}
    </div>
  );
}
