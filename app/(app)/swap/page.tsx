"use client";

import { ArrowLeftRight, ArrowRight, Check, FileSpreadsheet, Plus, Trash2, UserRoundPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { SwapDialog } from "@/components/requests/swap-dialog";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { Checkbox } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { dateTH, dateTimeTH } from "@/lib/domain/dates";
import { SHIFT_LABELS } from "@/lib/domain/schedule";
import { SWAP_TYPE_LABELS } from "@/lib/domain/swap";
import { exportSwapHistory } from "@/lib/export/schedule";
import type { Swap } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_META = {
  swap: { icon: ArrowLeftRight, cls: "bg-sky-100 text-sky-900" },
  giveaway: { icon: ArrowRight, cls: "bg-violet-100 text-violet-900" },
  substitute: { icon: UserRoundPlus, cls: "bg-emerald-100 text-emerald-900" },
};

export default function SwapPage() {
  const { swaps, me, myNurse, nurses, users, mutate, nurseName } = useNurseData();
  const [tab, setTab] = useState("pending");
  const [mineOnly, setMineOnly] = useState(me.role === "requester");
  const [open, setOpen] = useState(false);
  const isHead = me.role === "admin" || me.role === "approver";

  const visible = useMemo(
    () =>
      swaps
        .filter((s) => !mineOnly || s.requestedBy === me.username || (myNurse && (s.from === myNurse.id || s.to === myNurse.id)))
        .filter((s) => tab === "all" || s.status === tab),
    [swaps, tab, mineOnly, me.username, myNurse],
  );
  const count = (st: string) => swaps.filter((s) => (st === "all" || s.status === st) && (!mineOnly || s.requestedBy === me.username || (myNurse && (s.from === myNurse.id || s.to === myNurse.id)))).length;

  const decide = async (s: Swap, status: "approved" | "rejected") => {
    if (status === "approved") {
      const ok = await confirmDialog({
        title: "อนุมัติคำขอ",
        message: <p>ตารางเวรจะถูกเปลี่ยนให้ทันที: {nurseName(s.from)} → {nurseName(s.to)} วันที่ {dateTH(s.date)} กะ{SHIFT_LABELS[s.shift]}</p>,
        confirmText: "อนุมัติ",
      });
      if (!ok) return;
    }
    mutate(() => api(`/api/swaps/${s.id}`, { method: "PATCH", body: { status } }), status === "approved" ? "อนุมัติแล้ว — เปลี่ยนในตารางแล้ว" : "ปฏิเสธคำขอแล้ว");
  };

  const remove = async (s: Swap) => {
    if (await confirmDialog({ title: "ลบคำขอนี้?", message: "ลบเฉพาะรายการคำขอ (ไม่ย้อนการเปลี่ยนตาราง)", confirmText: "ลบ", tone: "danger" }))
      mutate(() => api(`/api/swaps/${s.id}`, { method: "DELETE" }), "ลบคำขอแล้ว");
  };

  const reqName = (u: string) => users.find((x) => x.username === u)?.fullname || u || "-";

  return (
    <div>
      <PageHeader
        title="แลกเวร"
        description="แลกเวร · ยกเวร · แทนเวร — อนุมัติแล้วระบบเปลี่ยนตารางให้ทันที"
        actions={
          <>
            {isHead && (
              <Button
                variant="outline"
                onClick={async () => {
                  const n = await exportSwapHistory(swaps, nurses);
                  if (!n) toast.warn("ยังไม่มีประวัติที่อนุมัติแล้ว");
                }}
              >
                <FileSpreadsheet /> Export ประวัติ
              </Button>
            )}
            <Button onClick={() => setOpen(true)} className="hidden sm:inline-flex">
              <Plus /> สร้างคำขอ
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Tabs value={tab} onValueChange={setTab} className="sm:w-auto">
          <TabsList>
            <TabsTrigger value="pending">รออนุมัติ ({count("pending")})</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
            <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          </TabsList>
        </Tabs>
        <Checkbox className="sm:ml-auto" label="เฉพาะที่เกี่ยวกับฉัน" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<ArrowLeftRight />} title="ไม่มีรายการ" description={tab === "pending" ? "ไม่มีคำขอที่รออนุมัติ" : undefined} />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((s) => {
            const meta = TYPE_META[s.type] || TYPE_META.swap;
            const Icon = meta.icon;
            return (
              <Card key={s.id} className={cn("border-l-4 p-4", s.status === "pending" ? "border-l-amber-400" : s.status === "approved" ? "border-l-emerald-500" : "border-l-rose-400")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={meta.cls}>
                    <Icon /> {SWAP_TYPE_LABELS[s.type]}
                  </Badge>
                  <StatusBadge status={s.status} />
                  <span className="ml-auto text-xs text-ink-mute">{dateTimeTH(s.createdAt)}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
                  <span className="font-semibold text-ink">{nurseName(s.from)}</span>
                  <Icon className="size-4 text-ink-mute" />
                  <span className="font-semibold text-ink">{nurseName(s.to)}</span>
                </div>
                <div className="mt-1.5 space-y-0.5 text-sm text-ink-soft">
                  <div>
                    {dateTH(s.date, true)} · กะ{SHIFT_LABELS[s.shift] || s.shift}
                  </div>
                  {s.type === "swap" && s.date2 && s.date2 !== s.date && (
                    <div>
                      รับแทน {dateTH(s.date2, true)} · กะ{SHIFT_LABELS[s.shift2 || s.shift]}
                    </div>
                  )}
                  {s.reason && <div className="text-ink">“{s.reason}”</div>}
                  <div className="text-xs text-ink-mute">
                    ผู้ขอ: {reqName(s.requestedBy)}
                    {s.status === "approved" && s.approvedAt && ` · อนุมัติโดย ${reqName(s.approvedBy)} ${dateTimeTH(s.approvedAt)}`}
                  </div>
                </div>
                {(isHead && s.status === "pending") || me.role === "admin" ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {isHead && s.status === "pending" && (
                      <>
                        <Button variant="success" className="flex-1 sm:flex-none" onClick={() => decide(s, "approved")}>
                          <Check /> อนุมัติ
                        </Button>
                        <Button variant="danger-soft" className="flex-1 sm:flex-none" onClick={() => decide(s, "rejected")}>
                          <X /> ปฏิเสธ
                        </Button>
                      </>
                    )}
                    {me.role === "admin" && (
                      <Button variant="ghost" size="icon" className="ml-auto" aria-label="ลบคำขอ" onClick={() => remove(s)}>
                        <Trash2 className="text-rose-600" />
                      </Button>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* ปุ่มลอยบนมือถือ */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-20 grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-pop)] active:scale-95 sm:hidden"
        aria-label="สร้างคำขอ"
      >
        <Plus className="size-7" />
      </button>
      {open && <SwapDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
