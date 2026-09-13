"use client";

import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { useNAData } from "@/components/data/na-data";
import { RequireNAAdmin } from "@/components/shell/na-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { WEEKDAY_SHORT_TH, WEEKDAY_TH, dateTH } from "@/lib/domain/dates";
import type { Assistant } from "@/lib/types";

export default function AssistantsPage() {
  return (
    <RequireNAAdmin>
      <Inner />
    </RequireNAAdmin>
  );
}

function Inner() {
  const { assistants, mutate } = useNAData();
  const [editing, setEditing] = useState<Assistant | null | undefined>(undefined);
  return (
    <div>
      <PageHeader
        title="รายชื่อผู้ช่วยพยาบาล"
        description={`${assistants.length} คน`}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus /> เพิ่ม
          </Button>
        }
      />
      <Card>
        <CardBody>
          {assistants.length === 0 ? (
            <EmptyState icon={<Users />} title="ยังไม่มีรายชื่อ" />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {assistants.map((a) => {
                const un = [
                  a.unavailableWeekdays.length ? "วัน " + a.unavailableWeekdays.map((i) => WEEKDAY_SHORT_TH[i]).join(",") : "",
                  a.unavailableShifts.length ? "ไม่ลงกะ " + a.unavailableShifts.map((s) => ({ morning: "เช้า", afternoon: "บ่าย", night: "ดึก" })[s] || s).join(",") : "",
                  a.unavailableDates.length ? `ไม่สะดวก ${a.unavailableDates.length} วัน` : "",
                ].filter(Boolean);
                return (
                  <li key={a.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-sm text-ink-soft">
                        {a.code}
                        {a.phone && ` · ${a.phone}`}
                        {un.length > 0 && ` · ${un.join(" · ")}`}
                      </div>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label="แก้ไข" onClick={() => setEditing(a)}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="ลบ"
                      onClick={async () =>
                        (await confirmDialog({ title: `ลบ ${a.name}?`, confirmText: "ลบ", tone: "danger" })) && mutate(() => api(`/api/na/assistants/${a.id}`, { method: "DELETE" }), "ลบแล้ว")
                      }
                    >
                      <Trash2 className="text-rose-600" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
      {editing !== undefined && <AssistantDialog a={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

function AssistantDialog({ a, onClose }: { a: Assistant | null; onClose: () => void }) {
  const { mutate } = useNAData();
  const [v, setV] = useState<Assistant>(a ? structuredClone(a) : { id: "", code: "", name: "", phone: "", unavailableDates: [], unavailableWeekdays: [], unavailableShifts: [] });
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={a ? "แก้ไขผู้ช่วยพยาบาล" : "เพิ่มผู้ช่วยพยาบาล"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={!v.code.trim() || !v.name.trim()}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              if (await mutate(() => (a ? api(`/api/na/assistants/${a.id}`, { method: "PUT", body: v }) : api("/api/na/assistants", { body: v })), "บันทึกแล้ว")) onClose();
              setSaving(false);
            }}
          >
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="รหัส *">
            <Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
          </Field>
          <Field label="เบอร์โทร">
            <Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="ชื่อ-นามสกุล *">
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="วันในสัปดาห์ที่ไม่สะดวก">
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_TH.map((w, i) => (
              <ChoiceChip
                key={w}
                checked={v.unavailableWeekdays.includes(i)}
                onChange={(on) => setV({ ...v, unavailableWeekdays: on ? [...v.unavailableWeekdays, i] : v.unavailableWeekdays.filter((x) => x !== i) })}
              >
                {w}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        <Field label="กะที่ไม่ลงเป็นประจำ">
          <div className="flex flex-wrap gap-2">
            {[
              ["morning", "เช้า"],
              ["afternoon", "บ่าย"],
              ["night", "ดึก"],
            ].map(([k, l]) => (
              <ChoiceChip key={k} checked={v.unavailableShifts.includes(k)} onChange={(on) => setV({ ...v, unavailableShifts: on ? [...v.unavailableShifts, k] : v.unavailableShifts.filter((x) => x !== k) })}>
                {l}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        <Field label="วันที่ไม่สะดวก">
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
            <Button
              variant="secondary"
              disabled={!date}
              onClick={() => {
                if (!v.unavailableDates.includes(date)) setV({ ...v, unavailableDates: [...v.unavailableDates, date].sort() });
                setDate("");
              }}
            >
              <Plus /> เพิ่ม
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.unavailableDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setV({ ...v, unavailableDates: v.unavailableDates.filter((x) => x !== d) })}
                className="inline-flex min-h-8 items-center gap-1 rounded-full bg-rose-100 px-3 text-sm text-rose-800"
              >
                {dateTH(d)} <X className="size-3.5" />
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}
