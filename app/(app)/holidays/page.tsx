"use client";

import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { RequirePage } from "@/components/shell/nurse-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { dateTH } from "@/lib/domain/dates";
import { HOLIDAY_YEARS, OFFICIAL_HOLIDAYS } from "@/lib/domain/holidays";
import type { Holiday } from "@/lib/types";

export default function HolidaysPage() {
  return (
    <RequirePage page="holidays">
      <HolidaysInner />
    </RequirePage>
  );
}

function HolidaysInner() {
  const { holidays, mutate } = useNurseData();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [editing, setEditing] = useState<Holiday | null | undefined>(undefined);
  const custom = holidays.filter((h) => h.date.startsWith(year));
  const official = OFFICIAL_HOLIDAYS[year] || [];
  const years = [...new Set([...HOLIDAY_YEARS, ...holidays.map((h) => h.date.slice(0, 4))])].sort();

  const remove = async (h: Holiday) => {
    if (await confirmDialog({ title: `ลบวันหยุด "${h.name}"?`, confirmText: "ลบ", tone: "danger" }))
      mutate(() => api(`/api/holidays/${h.date}`, { method: "DELETE" }), "ลบวันหยุดแล้ว");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="วันหยุด"
        description="วันหยุดพิเศษจะรวมกับวันหยุดนักขัตฤกษ์ และใช้กำหนดกะเช้าวันหยุดตอนจัดเวร"
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-40" aria-label="ปี">
              {years.map((y) => (
                <option key={y} value={y}>
                  ปี {Number(y) + 543}
                </option>
              ))}
            </Select>
            <Button onClick={() => setEditing(null)}>
              <Plus /> เพิ่มวันหยุด
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="วันหยุดพิเศษ" description={`${custom.length} วัน`} />
          {custom.length === 0 ? (
            <EmptyState icon={<CalendarOff />} title={`ยังไม่มีวันหยุดพิเศษในปี ${Number(year) + 543}`} />
          ) : (
            <ul className="divide-y divide-line">
              {custom.map((h) => (
                <li key={h.date} className="flex min-h-14 items-center gap-2 px-4 py-2 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{h.name}</div>
                    <div className="text-sm text-ink-soft">{dateTH(h.date, true)}</div>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="แก้ไข" onClick={() => setEditing(h)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="ลบ" onClick={() => remove(h)}>
                    <Trash2 className="text-rose-600" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="วันหยุดนักขัตฤกษ์" description="มีอยู่ในระบบแล้ว" actions={<Badge className="bg-slate-100 text-slate-700">{official.length} วัน</Badge>} />
          <CardBody className="p-0 sm:p-0">
            <ul className="divide-y divide-line">
              {official.map((h) => (
                <li key={h.date} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="w-28 shrink-0 text-sm text-ink-soft">{dateTH(h.date)}</span>
                  <span className="text-[15px] text-ink">{h.name}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      {editing !== undefined && <HolidayDialog holiday={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

function HolidayDialog({ holiday, onClose }: { holiday: Holiday | null; onClose: () => void }) {
  const { mutate } = useNurseData();
  const [date, setDate] = useState(holiday?.date || "");
  const [name, setName] = useState(holiday?.name || "");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={holiday ? "แก้ไขวันหยุด" : "เพิ่มวันหยุดพิเศษ"}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={!date || !name.trim()}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await mutate(
                () => (holiday ? api(`/api/holidays/${holiday.date}`, { method: "PUT", body: { date, name } }) : api("/api/holidays", { body: { date, name } })),
                "บันทึกวันหยุดแล้ว",
              );
              setSaving(false);
              if (ok) onClose();
            }}
          >
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="วันที่ *">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="ชื่อวันหยุด *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น วันหยุดพิเศษ" maxLength={200} />
        </Field>
      </div>
    </Dialog>
  );
}
