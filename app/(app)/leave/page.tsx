"use client";

import { Check, Palmtree, Plus, Star, Stethoscope, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, ChoiceChip, Field, Input, Textarea } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client/api";
import { dateTH, dateTimeTH } from "@/lib/domain/dates";
import { LEAVE_TYPES, affectedShifts, leaveDates, suggestReplacement } from "@/lib/domain/leave";
import { shiftLabelOf } from "@/lib/domain/schedule";
import type { Leave, LeaveType } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function LeavePage() {
  const { leaves, me, myNurse, users, mutate, nurseName, schedule, nurses } = useNurseData();
  const [tab, setTab] = useState("pending");
  const [mineOnly, setMineOnly] = useState(me.role === "requester");
  const [open, setOpen] = useState(false);
  const isHead = me.role === "admin" || me.role === "approver";

  const mine = (l: Leave) => l.requestedBy === me.username || l.nurseId === myNurse?.id;
  const visible = useMemo(() => leaves.filter((l) => (!mineOnly || mine(l)) && (tab === "all" || l.status === tab)), [leaves, tab, mineOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const reqName = (u: string) => users.find((x) => x.username === u)?.fullname || u || "-";

  const decide = (l: Leave, status: "approved" | "rejected") =>
    mutate(() => api(`/api/leaves/${l.id}`, { method: "PATCH", body: { status } }), status === "approved" ? "อนุมัติการลาแล้ว" : "ปฏิเสธคำขอลาแล้ว");
  const remove = async (l: Leave) => {
    if (await confirmDialog({ title: "ลบคำขอลานี้?", confirmText: "ลบ", tone: "danger" })) mutate(() => api(`/api/leaves/${l.id}`, { method: "DELETE" }), "ลบคำขอลาแล้ว");
  };
  const replace = (l: Leave, date: string, shift: string, replacementId: string) =>
    mutate(() => api(`/api/leaves/${l.id}/replace`, { body: { date, shift, replacementId } }), `ใส่ ${nurseName(replacementId)} ขึ้นแทนแล้ว`);

  return (
    <div>
      <PageHeader
        title="วันลา"
        description="ลากิจ · ลาป่วย · ลาพักร้อน — อนุมัติแล้วระบบจะไม่จัดเวรในวันลา และแนะนำคนขึ้นแทนเมื่อลาป่วยทับเวร"
        actions={
          <Button onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            <Plus /> ขอลา
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">รออนุมัติ ({leaves.filter((l) => l.status === "pending" && (!mineOnly || mine(l))).length})</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
            <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          </TabsList>
        </Tabs>
        <Checkbox className="sm:ml-auto" label="เฉพาะของฉัน" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<Palmtree />} title="ไม่มีรายการ" />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((l) => {
            const days = leaveDates(l).length;
            const affected = l.type === "sick" && l.status === "approved" && isHead ? affectedShifts(schedule, l) : [];
            return (
              <Card key={l.id} className={cn("border-l-4 p-4", l.status === "pending" ? "border-l-amber-400" : l.status === "approved" ? "border-l-emerald-500" : "border-l-rose-400")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-orange-100 text-orange-900">{LEAVE_TYPES[l.type] || l.type}</Badge>
                  <StatusBadge status={l.status} />
                  <span className="ml-auto text-xs text-ink-mute">{dateTimeTH(l.createdAt)}</span>
                </div>
                <div className="mt-2 text-[15px] font-semibold text-ink">{nurseName(l.nurseId)}</div>
                <div className="mt-1 text-sm text-ink-soft">
                  {l.dateFrom === l.dateTo ? dateTH(l.dateFrom, true) : `${dateTH(l.dateFrom)} – ${dateTH(l.dateTo)}`} · {days} วัน
                </div>
                {l.reason && <div className="mt-1 text-sm text-ink">“{l.reason}”</div>}
                <div className="mt-1 text-xs text-ink-mute">ผู้ขอ: {reqName(l.requestedBy)}</div>

                {affected.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-rose-800">
                      <Stethoscope className="size-4" /> แนะนำคนขึ้นแทน ({affected.length} เวรได้รับผลกระทบ)
                    </div>
                    {affected.map((a) => {
                      const sug = suggestReplacement(schedule, nurses, leaves, a.dateStr, l.nurseId);
                      return (
                        <div key={a.dateStr + a.shift}>
                          <div className="text-sm font-semibold text-ink">
                            {dateTH(a.dateStr, true)} · {shiftLabelOf(a.shift)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {sug.length === 0 && <span className="text-sm text-ink-mute">— ไม่มีคนว่างที่แนะนำได้ —</span>}
                            {sug.map((r, i) => (
                              <Button key={r.nurse.id} size="sm" variant={i === 0 ? "success" : "outline"} onClick={() => replace(l, a.dateStr, a.shift, r.nurse.id)}>
                                {i === 0 && <Star />} {r.nurse.name} <span className="opacity-70">({r.load} เวร/±3 วัน)</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {((isHead && l.status === "pending") || me.role === "admin") && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {isHead && l.status === "pending" && (
                      <>
                        <Button variant="success" className="flex-1 sm:flex-none" onClick={() => decide(l, "approved")}>
                          <Check /> อนุมัติ
                        </Button>
                        <Button variant="danger-soft" className="flex-1 sm:flex-none" onClick={() => decide(l, "rejected")}>
                          <X /> ปฏิเสธ
                        </Button>
                      </>
                    )}
                    {me.role === "admin" && (
                      <Button variant="ghost" size="icon" className="ml-auto" aria-label="ลบคำขอลา" onClick={() => remove(l)}>
                        <Trash2 className="text-rose-600" />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-20 grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-pop)] active:scale-95 sm:hidden"
        aria-label="ขอลา"
      >
        <Plus className="size-7" />
      </button>
      {open && <LeaveDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function LeaveDialog({ onClose }: { onClose: () => void }) {
  const { nurses, me, myNurse, mutate } = useNurseData();
  const [nurseId, setNurseId] = useState(me.role === "requester" ? myNurse?.id || "" : "");
  const [type, setType] = useState<LeaveType>("personal");
  const [dateFrom, setFrom] = useState("");
  const [dateTo, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const items = nurses
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
    .map((n) => ({ value: n.id, label: `${n.code} ${n.name}` }));
  const badRange = dateTo && dateFrom && dateTo < dateFrom;

  const submit = async () => {
    setSaving(true);
    const ok = await mutate(() => api("/api/leaves", { body: { nurseId, type, dateFrom, dateTo: dateTo || dateFrom, reason } }), "ส่งคำขอลาแล้ว");
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="ขอลา"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit} loading={saving} disabled={!nurseId || !dateFrom || !!badRange}>
            ส่งคำขอลา
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {me.role === "requester" && !myNurse && <Alert tone="warn">บัญชีของคุณยังไม่ได้ผูกกับพยาบาล กรุณาให้แอดมินผูกรหัสพยาบาลก่อน</Alert>}
        <Field label="พยาบาลที่ลา">
          <Combobox items={items} value={nurseId} onChange={setNurseId} disabled={me.role === "requester"} placeholder="เลือกพยาบาล..." />
        </Field>
        <Field label="ประเภทการลา">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LEAVE_TYPES) as LeaveType[]).map((t) => (
              <ChoiceChip key={t} type="radio" name="leave-type" checked={type === t} onChange={() => setType(t)}>
                {LEAVE_TYPES[t]}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ตั้งแต่วันที่">
            <Input type="date" value={dateFrom} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึงวันที่" hint="เว้นว่าง = วันเดียว">
            <Input type="date" value={dateTo} min={dateFrom} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {badRange && <Alert tone="danger">วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม</Alert>}
        <Field label="เหตุผล">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Dialog>
  );
}
