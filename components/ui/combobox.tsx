"use client";

import { Popover } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboItem {
  value: string;
  label: string;
  hint?: string;
}

/** เลือกจากรายการยาว ๆ แบบพิมพ์ค้นหาได้ (แทน select ธรรมดาในหน้าแลกเวร/ลา) — ใช้คีย์บอร์ดได้ */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = "เลือก...",
  disabled,
  id,
}: {
  items: ComboItem[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.value === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => (i.label + " " + (i.hint || "")).toLowerCase().includes(s)) : items;
  }, [items, q]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setActive(Math.max(0, filtered.findIndex((i) => i.value === value)));
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-left text-[15px] transition-[border,box-shadow] focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15 disabled:bg-canvas disabled:text-ink-soft",
            !selected && "text-ink-mute",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-mute" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 text-ink-mute" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(filtered.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && filtered[active]) {
                  e.preventDefault();
                  pick(filtered[active].value);
                }
              }}
              placeholder="พิมพ์ค้นหาชื่อ/รหัส..."
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </div>
          <div ref={listRef} role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-ink-mute">ไม่พบรายชื่อ</div>}
            {filtered.map((it, i) => (
              <button
                key={it.value}
                type="button"
                role="option"
                aria-selected={it.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(it.value)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[15px]",
                  i === active ? "bg-brand-50 text-brand-900" : "text-ink",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{it.label}</span>
                  {it.hint && <span className="block truncate text-xs text-ink-mute">{it.hint}</span>}
                </span>
                {it.value === value && <Check className="size-4 text-brand-600" />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
