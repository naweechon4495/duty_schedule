"use client";

import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warn" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let listeners: ((t: ToastItem[]) => void)[] = [];
let items: ToastItem[] = [];
let seq = 0;

function emit() {
  listeners.forEach((l) => l(items));
}

export function toast(message: string, type: ToastType = "info") {
  const id = ++seq;
  items = [...items, { id, type, message }];
  emit();
  setTimeout(() => dismiss(id), type === "error" ? 6000 : 3500);
}
toast.success = (m: string) => toast(m, "success");
toast.error = (m: string) => toast(m, "error");
toast.warn = (m: string) => toast(m, "warn");

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const ICONS = { success: CheckCircle2, error: XCircle, warn: TriangleAlert, info: Info };
const TONES = {
  success: "border-l-emerald-500 [&_svg]:text-emerald-600",
  error: "border-l-rose-500 [&_svg]:text-rose-600",
  warn: "border-l-amber-500 [&_svg]:text-amber-600",
  info: "border-l-brand-500 [&_svg]:text-brand-600",
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-96"
      role="status"
      aria-live="polite"
    >
      {list.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cn(
              "pointer-events-auto flex animate-slide-up items-start gap-2.5 rounded-xl border border-l-4 border-line bg-surface px-3.5 py-3 text-left text-sm font-medium text-ink shadow-[var(--shadow-pop)]",
              TONES[t.type],
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0" />
            <span className="whitespace-pre-line">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
