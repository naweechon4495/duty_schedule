import * as React from "react";
import { GEN_LABELS, shiftTone, type ShiftTone } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5", className)}
      {...props}
    />
  );
}

export const SHIFT_TONE_CLASS: Record<ShiftTone, string> = {
  morning: "bg-amber-100 text-amber-900",
  afternoon: "bg-sky-100 text-sky-900",
  night: "bg-slate-700 text-white",
  preop: "bg-violet-100 text-violet-900",
  custom: "bg-fuchsia-100 text-fuchsia-900",
  leave: "bg-orange-100 text-orange-900",
};

export const SHIFT_DOT_CLASS: Record<ShiftTone, string> = {
  morning: "bg-amber-400",
  afternoon: "bg-sky-500",
  night: "bg-slate-700",
  preop: "bg-violet-500",
  custom: "bg-fuchsia-500",
  leave: "bg-orange-400",
};

export function ShiftChip({ shift, tone, children, className }: { shift?: string; tone?: ShiftTone; children: React.ReactNode; className?: string }) {
  const t = tone ?? shiftTone(shift || "morning");
  return <Badge className={cn(SHIFT_TONE_CLASS[t], "rounded-md px-1.5", className)}>{children}</Badge>;
}

const GEN_CLASS: Record<string, string> = {
  "1": "bg-teal-100 text-teal-900",
  "2": "bg-emerald-100 text-emerald-900",
  "3": "bg-amber-100 text-amber-900",
  "4": "bg-pink-100 text-pink-900",
  staff: "bg-indigo-100 text-indigo-900",
};

export function GenBadge({ gen, className }: { gen: string; className?: string }) {
  return <Badge className={cn(GEN_CLASS[gen] || "bg-slate-100 text-slate-800", className)}>{GEN_LABELS[gen] || "รุ่น " + gen}</Badge>;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "รออนุมัติ", cls: "bg-amber-100 text-amber-900" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-emerald-100 text-emerald-900" },
  rejected: { label: "ปฏิเสธ", cls: "bg-rose-100 text-rose-900" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: "bg-slate-100 text-slate-800" };
  return <Badge className={s.cls}>{s.label}</Badge>;
}

const ROLE_CLASS: Record<string, string> = {
  admin: "bg-rose-100 text-rose-800",
  naadmin: "bg-rose-100 text-rose-800",
  approver: "bg-amber-100 text-amber-900",
  requester: "bg-brand-100 text-brand-800",
  assistant: "bg-emerald-100 text-emerald-800",
};

export function RoleBadge({ role, label }: { role: string; label: string }) {
  return <Badge className={ROLE_CLASS[role] || "bg-slate-100"}>{label}</Badge>;
}
