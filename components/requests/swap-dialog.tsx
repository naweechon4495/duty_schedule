"use client";

import { ArrowLeftRight, ArrowRight, CheckCircle2, UserRoundPlus, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { SwapType } from "@/lib/types";
import { useNurseData } from "@/components/data/nurse-data";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { SHIFT_LABELS, getDay, hasShiftOnDate, shiftsOf } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

const SHIFT_OPTIONS = ["morning", "afternoon", "night", "preop_morning", "preop_afternoon", "preop"];

const TYPES: { value: SwapType; icon: React.ReactNode; title: string; sub: string }[] = [
  { value: "swap", icon: <ArrowLeftRight />, title: "แลกเวร", sub: "สลับเวรกัน" },
  { value: "giveaway", icon: <ArrowRight />, title: "ยกเวร", sub: "ยกให้เลย" },
  { value: "substitute", icon: <UserRoundPlus />, title: "แทนเวร", sub: "หัวหน้าเพิ่มคนแทน" },
];

function ShiftHint({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={cn("mt-1.5 flex items-center gap-1.5 text-sm", ok ? "text-emerald-700" : "text-rose-700")}>
      {ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      {text}
    </p>
  );
}

export function SwapDialog({ onClose }: { onClose: () => void }) {
  const { nurses, schedule, me, myNurse, mutate, nurseName } = useNurseData();
  const isHead = me.role === "admin" || me.role === "approver";
  const [type, setType] = useState<SwapType>("swap");
  const [from, setFrom] = useState(me.role === "requester" ? myNurse?.id || "" : "");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("afternoon");
  const [date2, setDate2] = useState("");
  const [shift2, setShift2] = useState("afternoon");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const items = useMemo(
    () =>
      nurses
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
        .map((n) => ({ value: n.id, label: `${n.code} ${n.name}`, hint: `รุ่น ${n.generation}` })),
    [nurses],
  );

  const fromShifts = from && date ? shiftsOf(getDay(schedule, date), from) : [];
  const effDate2 = date2 || date;
  const toShifts = to && effDate2 ? shiftsOf(getDay(schedule, effDate2), to) : [];
  const fromOk = !!from && !!date && hasShiftOnDate(schedule, from, date, shift);
  const toOk = type !== "swap" || (!!to && !!effDate2 && hasShiftOnDate(schedule, to, effDate2, shift2));
  const valid = from && to && from !== to && date && fromOk && toOk;

  const submit = async () => {
    setSaving(true);
    const ok = await mutate(
      () => api("/api/swaps", { body: { type, from, to, date, shift, date2: type === "swap" ? effDate2 : date, shift2: type === "swap" ? shift2 : shift, reason } }),
      { swap: "ส่งคำขอแลกเวรแล้ว", giveaway: "ส่งคำขอยกเวรแล้ว", substitute: "บันทึกแทนเวรแล้ว (รออนุมัติ)" }[type],
    );
    setSaving(false);
    if (ok) onClose();
  };

  const types = TYPES.filter((t) => t.value !== "substitute" || isHead);
  const isSub = type === "substitute";

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={{ swap: "ขอแลกเวร", giveaway: "ขอยกเวร", substitute: "แทนเวร (หัวหน้าเพิ่มคนแทน)" }[type]}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            ส่งคำขอ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className={cn("grid gap-2", types.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="radiogroup" aria-label="ประเภท">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-colors [&_svg]:size-6",
                type === t.value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line text-ink-soft hover:bg-canvas",
              )}
            >
              {t.icon}
              <span className="font-bold">{t.title}</span>
              <span className="text-xs">{t.sub}</span>
            </button>
          ))}
        </div>

        {me.role === "requester" && !myNurse && <Alert tone="warn">บัญชีของคุณยังไม่ได้ผูกกับพยาบาล กรุณาให้แอดมินผูกรหัสพยาบาลก่อน</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isSub ? "คนที่ไม่มา (A)" : "ผู้ขอ (A)"} className="sm:col-span-2">
            <Combobox items={items} value={from} onChange={setFrom} disabled={me.role === "requester"} placeholder="เลือกพยาบาล..." />
          </Field>
          <Field label="วันที่">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={isSub ? "เวรที่ต้องมาแทน" : "เวรที่ขอแลก"}>
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              {SHIFT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SHIFT_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          {from && date && (
            <div className="sm:col-span-2 -mt-2">
              {fromOk ? (
                <ShiftHint ok text={`${nurseName(from)} มีเวร${SHIFT_LABELS[shift]}วันนี้`} />
              ) : (
                <ShiftHint ok={false} text={fromShifts.length ? `วันนี้ ${nurseName(from)} มีเวร: ${fromShifts.map((s) => SHIFT_LABELS[s] || s).join(", ")}` : `${nurseName(from)} ไม่มีเวรวันนี้`} />
              )}
            </div>
          )}

          <Field label={isSub ? "คนมาแทน (B)" : type === "giveaway" ? "ยกให้ (B)" : "ผู้รับแทน (B)"} className="sm:col-span-2">
            <Combobox items={items.filter((i) => i.value !== from)} value={to} onChange={setTo} placeholder="เลือกพยาบาล..." />
          </Field>
          {type === "swap" && (
            <>
              <Field label="วันที่รับแทน" hint="เว้นว่าง = วันเดียวกัน">
                <Input type="date" value={date2} onChange={(e) => setDate2(e.target.value)} />
              </Field>
              <Field label="เวรของผู้รับแทน (B)">
                <Select value={shift2} onChange={(e) => setShift2(e.target.value)}>
                  {SHIFT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {SHIFT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              {to && effDate2 && (
                <div className="sm:col-span-2 -mt-2">
                  {toOk ? (
                    <ShiftHint ok text={`${nurseName(to)} มีเวร${SHIFT_LABELS[shift2]}วันที่รับแทน`} />
                  ) : (
                    <ShiftHint ok={false} text={toShifts.length ? `วันนั้น ${nurseName(to)} มีเวร: ${toShifts.map((s) => SHIFT_LABELS[s] || s).join(", ")}` : `${nurseName(to)} ไม่มีเวรวันนั้น`} />
                  )}
                </div>
              )}
            </>
          )}
          <Field label={isSub ? "เหตุผล (เช่น ป่วย/ไม่มาปฏิบัติงาน)" : "เหตุผล"} className="sm:col-span-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
