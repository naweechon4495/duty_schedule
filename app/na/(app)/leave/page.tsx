"use client";

import { Check, Palmtree, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNAData } from "@/components/data/na-data";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input, Textarea } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client/api";
import { dateTH, dateTimeTH } from "@/lib/domain/dates";
import { LEAVE_TYPES } from "@/lib/domain/leave";
import type { LeaveType } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function NALeavePage() {
  const { leaves, isAdmin, mutate, name, users } = useNAData();
  const [tab, setTab] = useState("pending");
  const [open, setOpen] = useState(false);
  const list = leaves.filter((l) => tab === "all" || l.status === tab);
  return (
    <div>
      <PageHeader
        title="วันลา NA"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> ขอลา
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="sm:w-auto">
          <TabsTrigger value="pending">รออนุมัติ ({leaves.filter((l) => l.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
          <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
          <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Palmtree />} title="ไม่มีรายการ" />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((l) => (
            <Card key={l.id} className={cn("border-l-4 p-4", l.status === "pending" ? "border-l-amber-400" : l.status === "approved" ? "border-l-emerald-500" : "border-l-rose-400")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-orange-100 text-orange-900">{LEAVE_TYPES[l.type]}</Badge>
                <StatusBadge status={l.status} />
                <span className="ml-auto text-xs text-ink-mute">{dateTimeTH(l.createdAt)}</span>
              </div>
              <div className="mt-2 font-semibold">{name(l.assistantId)}</div>
              <div className="text-sm text-ink-soft">{l.dateFrom === l.dateTo ? dateTH(l.dateFrom, true) : `${dateTH(l.dateFrom)} – ${dateTH(l.dateTo)}`}</div>
              {l.reason && <div className="mt-1 text-sm">“{l.reason}”</div>}
              <div className="mt-1 text-xs text-ink-mute">ผู้ขอ: {users.find((u) => u.username === l.requestedBy)?.fullname || l.requestedBy}</div>
              {isAdmin && (
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  {l.status === "pending" && (
                    <>
                      <Button variant="success" onClick={() => mutate(() => api(`/api/na/leaves/${l.id}`, { method: "PATCH", body: { status: "approved" } }), "อนุมัติแล้ว")}>
                        <Check /> อนุมัติ
                      </Button>
                      <Button variant="danger-soft" onClick={() => mutate(() => api(`/api/na/leaves/${l.id}`, { method: "PATCH", body: { status: "rejected" } }), "ปฏิเสธแล้ว")}>
                        <X /> ปฏิเสธ
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    aria-label="ลบ"
                    onClick={async () => (await confirmDialog({ title: "ลบคำขอลานี้?", confirmText: "ลบ", tone: "danger" })) && mutate(() => api(`/api/na/leaves/${l.id}`, { method: "DELETE" }), "ลบแล้ว")}
                  >
                    <Trash2 className="text-rose-600" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {open && <NALeaveDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NALeaveDialog({ onClose }: { onClose: () => void }) {
  const { assistants, mine, me, mutate } = useNAData();
  const [assistantId, setId] = useState(me.role === "assistant" ? mine?.id || "" : "");
  const [type, setType] = useState<LeaveType>("personal");
  const [dateFrom, setFrom] = useState("");
  const [dateTo, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
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
          <Button
            disabled={!assistantId || !dateFrom || (!!dateTo && dateTo < dateFrom)}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              if (await mutate(() => api("/api/na/leaves", { body: { assistantId, type, dateFrom, dateTo: dateTo || dateFrom, reason } }), "ส่งคำขอลาแล้ว")) onClose();
              setSaving(false);
            }}
          >
            ส่งคำขอลา
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ผู้ช่วยพยาบาล">
          <Combobox items={assistants.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} value={assistantId} onChange={setId} disabled={me.role === "assistant"} placeholder="เลือก..." />
        </Field>
        <Field label="ประเภท">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LEAVE_TYPES) as LeaveType[]).map((t) => (
              <ChoiceChip key={t} type="radio" name="na-leave" checked={type === t} onChange={() => setType(t)}>
                {LEAVE_TYPES[t]}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ตั้งแต่">
            <Input type="date" value={dateFrom} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึง" hint="เว้นว่าง = วันเดียว">
            <Input type="date" value={dateTo} min={dateFrom} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="เหตุผล">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
