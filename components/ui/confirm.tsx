"use client";

import { useState } from "react";
import { createStore } from "@/lib/client/store";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./form";

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  tone?: "danger" | "primary";
  /** ต้องพิมพ์คำนี้ก่อนกดยืนยัน (ใช้กับการกระทำที่ย้อนไม่ได้) */
  typeToConfirm?: string;
}

const store = createStore<{ opts: ConfirmOptions | null; resolve: ((v: boolean) => void) | null }>({ opts: null, resolve: null });

/** แทน window.confirm — คืน Promise<boolean> */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => store.set({ opts, resolve }));
}

export function ConfirmHost() {
  const { opts, resolve } = store.use();
  const [typed, setTyped] = useState("");
  const close = (v: boolean) => {
    resolve?.(v);
    store.set({ opts: null, resolve: null });
    setTyped("");
  };
  if (!opts) return null;
  const blocked = !!opts.typeToConfirm && typed.trim() !== opts.typeToConfirm;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close(false)}
      title={opts.title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            ยกเลิก
          </Button>
          <Button variant={opts.tone === "danger" ? "danger" : "primary"} disabled={blocked} onClick={() => close(true)}>
            {opts.confirmText || "ยืนยัน"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
        {opts.message}
        {opts.typeToConfirm && (
          <div>
            <p className="mb-1.5 text-sm">
              พิมพ์ <strong className="text-ink">{opts.typeToConfirm}</strong> เพื่อยืนยัน
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
      </div>
    </Dialog>
  );
}
