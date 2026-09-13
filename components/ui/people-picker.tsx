"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface PersonOption {
  id: string;
  label: string;
  hint?: string;
}

/** เลือกหลายคนแบบค้นหาได้ (แทน select multiple ที่ต้องกด Ctrl) — แสดงคนที่เลือกเป็นชิปลบได้ */
export function PeoplePicker({ options, value, onChange, maxHeight = "max-h-56" }: { options: PersonOption[]; value: string[]; onChange: (ids: string[]) => void; maxHeight?: string }) {
  const [q, setQ] = useState("");
  const selected = new Set(value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => (o.label + " " + (o.hint || "")).toLowerCase().includes(s)) : options;
  }, [options, q]);
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="rounded-xl border border-line">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line p-2">
          {value.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-brand-50 px-2.5 text-sm font-medium text-brand-800 hover:bg-brand-100"
            >
              {options.find((o) => o.id === id)?.label || id}
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="size-4 text-ink-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัส..." className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
      </div>
      <div className={cn("overflow-y-auto p-1", maxHeight)}>
        {filtered.map((o) => (
          <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-canvas">
            <input type="checkbox" className="size-5 accent-brand-600" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{o.label}</span>
              {o.hint && <span className="block text-xs text-ink-mute">{o.hint}</span>}
            </span>
          </label>
        ))}
        {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-mute">ไม่พบรายชื่อ</div>}
      </div>
    </div>
  );
}
