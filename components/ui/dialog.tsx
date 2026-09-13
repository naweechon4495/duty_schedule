"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dialog ที่ปรับตามขนาดจอ
 * - มือถือ (<640px): เต็มจอเลื่อนขึ้นจากล่าง ปุ่มบันทึกติดล่าง (ไม่ต้องเลื่อนหา)
 * - แท็บเล็ต/เดสก์ท็อป: กล่องกลางจอ
 * side="right": drawer ด้านขวา (เดสก์ท็อป) — ใช้แสดงรายละเอียดโดยไม่บังเนื้อหาหลัก
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  side = "center",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "center" | "right";
}) {
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-[var(--shadow-pop)] outline-none",
            // มือถือ: เต็มจอจากล่าง
            "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-2xl data-[state=open]:animate-slide-up",
            side === "center" &&
              cn("sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl", widths[size]),
            side === "right" &&
              "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-2xl sm:data-[state=open]:animate-slide-left",
          )}
          onOpenAutoFocus={(e) => {
            // มือถือไม่ต้อง focus input อัตโนมัติ (คีย์บอร์ดเด้งบังฟอร์ม)
            if (window.matchMedia("(max-width: 639px)").matches) e.preventDefault();
          }}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
          <div className="flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0 flex-1">
              <D.Title className="text-lg font-bold text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-sm text-ink-soft">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : "หน้าต่าง"}</D.Description>
              )}
            </div>
            <D.Close className="-mr-2 grid size-10 place-items-center rounded-full text-ink-soft hover:bg-canvas" aria-label="ปิด">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer && (
            <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-4 py-3 sm:px-5 [&>button]:flex-1 sm:[&>button]:flex-none">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
