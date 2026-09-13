"use client";

import { ArrowLeftRight, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNAData } from "@/components/data/na-data";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client/api";
import { dateTH, dateTimeTH } from "@/lib/domain/dates";
import { NA_SHIFT_LABELS, naShiftOnDate } from "@/lib/domain/na";
import { cn } from "@/lib/utils";

export default function NASwapPage() {
  const { swaps, isAdmin, mutate, name, users } = useNAData();
  const [tab, setTab] = useState("pending");
  const [open, setOpen] = useState(false);
  const list = swaps.filter((s) => tab === "all" || s.status === tab);
  const reqName = (u: string) => users.find((x) => x.username === u)?.fullname || u;

  return (
    <div>
      <PageHeader
        title="แลกเวร NA"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> ขอแลก/ยกเวร
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="sm:w-auto">
          <TabsTrigger value="pending">รออนุมัติ ({swaps.filter((s) => s.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
          <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
          <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<ArrowLeftRight />} title="ไม่มีรายการ" />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((s) => (
            <Card key={s.id} className={cn("border-l-4 p-4", s.status === "pending" ? "border-l-amber-400" : s.status === "approved" ? "border-l-emerald-500" : "border-l-rose-400")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={s.type === "giveaway" ? "bg-violet-100 text-violet-900" : "bg-sky-100 text-sky-900"}>{s.type === "giveaway" ? "ยกเวร" : "แลกเวร"}</Badge>
                <StatusBadge status={s.status} />
                <span className="ml-auto text-xs text-ink-mute">{dateTimeTH(s.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-semibold">
                {name(s.from)} {s.type === "giveaway" ? <ArrowRight className="size-4" /> : <ArrowLeftRight className="size-4" />} {name(s.to)}
              </div>
              <div className="mt-1 text-sm text-ink-soft">
                {dateTH(s.date, true)} · กะ{NA_SHIFT_LABELS[s.shift] || s.shift}
                {s.type !== "giveaway" && s.date2 !== s.date && ` · รับแทน ${dateTH(s.date2)}`}
              </div>
              {s.reason && <div className="mt-1 text-sm">“{s.reason}”</div>}
              <div className="mt-1 text-xs text-ink-mute">ผู้ขอ: {reqName(s.requestedBy)}</div>
              {isAdmin && (
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  {s.status === "pending" && (
                    <>
                      <Button variant="success" onClick={() => mutate(() => api(`/api/na/swaps/${s.id}`, { method: "PATCH", body: { status: "approved" } }), "อนุมัติแล้ว — เปลี่ยนในตารางแล้ว")}>
                        <Check /> อนุมัติ
                      </Button>
                      <Button variant="danger-soft" onClick={() => mutate(() => api(`/api/na/swaps/${s.id}`, { method: "PATCH", body: { status: "rejected" } }), "ปฏิเสธแล้ว")}>
                        <X /> ปฏิเสธ
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    aria-label="ลบ"
                    onClick={async () => (await confirmDialog({ title: "ลบคำขอนี้?", confirmText: "ลบ", tone: "danger" })) && mutate(() => api(`/api/na/swaps/${s.id}`, { method: "DELETE" }), "ลบแล้ว")}
                  >
                    <Trash2 className="text-rose-600" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {open && <NASwapDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NASwapDialog({ onClose }: { onClose: () => void }) {
  const { assistants, mine, me, schedule, mutate } = useNAData();
  const [type, setType] = useState<"swap" | "giveaway">("swap");
  const [from, setFrom] = useState(me.role === "assistant" ? mine?.id || "" : "");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [date2, setDate2] = useState("");
  const [shift, setShift] = useState("afternoon");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const items = assistants.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const ok = from && to && from !== to && date && naShiftOnDate(schedule, from, date, shift);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={type === "swap" ? "ขอแลกเวร" : "ขอยกเวร"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={!ok}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              if (await mutate(() => api("/api/na/swaps", { body: { type, from, to, date, date2: date2 || date, shift, reason } }), "ส่งคำขอแล้ว")) onClose();
              setSaving(false);
            }}
          >
            ส่งคำขอ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <ChoiceChip type="radio" name="na-type" checked={type === "swap"} onChange={() => setType("swap")}>
            แลกเวร
          </ChoiceChip>
          <ChoiceChip type="radio" name="na-type" checked={type === "giveaway"} onChange={() => setType("giveaway")}>
            ยกเวร
          </ChoiceChip>
        </div>
        <Field label="ผู้ขอ">
          <Combobox items={items} value={from} onChange={setFrom} disabled={me.role === "assistant"} placeholder="เลือก..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="กะ">
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              {Object.entries(NA_SHIFT_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {from && date && !naShiftOnDate(schedule, from, date, shift) && <p className="text-sm text-rose-700">ไม่พบเวรนี้ของผู้ขอในตาราง</p>}
        <Field label={type === "swap" ? "ผู้รับแทน" : "ยกให้"}>
          <Combobox items={items.filter((i) => i.value !== from)} value={to} onChange={setTo} placeholder="เลือก..." />
        </Field>
        {type === "swap" && (
          <Field label="วันที่รับแทน" hint="เว้นว่าง = วันเดียวกัน">
            <Input type="date" value={date2} onChange={(e) => setDate2(e.target.value)} />
          </Field>
        )}
        <Field label="เหตุผล">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
