"use client";

import { CalendarPlus, CheckCircle2, ChevronDown, Info, Save, Trash2, TriangleAlert, WandSparkles } from "lucide-react";
import { useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { CustomShiftDialog } from "@/components/schedule/custom-shift-dialog";
import { FairnessTable } from "@/components/schedule/fairness-table";
import { SnapshotPanel } from "@/components/schedule/snapshot-panel";
import { RequirePage } from "@/components/shell/nurse-shell";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { autoSchedule, type AutoScheduleResult } from "@/lib/domain/autoSchedule";
import { currentMonthKey, monthTitleTH } from "@/lib/domain/dates";
import type { BootstrapData } from "@/lib/types";

function slotsOf(ms: Record<number, Record<string, string[]>> | undefined) {
  if (!ms) return 0;
  // นับทุกกะรวมเวรกำหนดเอง (ไม่นับ On call ที่ซ้อนอยู่ในกะดึก) — ตรงกับตัวเลขใน Log
  return Object.values(ms).reduce((s, ds) => s + Object.entries(ds).reduce((a, [k, ids]) => a + (k === "night_oncall" ? 0 : ids?.length || 0), 0), 0);
}

export default function SchedulePage() {
  return (
    <RequirePage page="schedule">
      <ScheduleInner />
    </RequirePage>
  );
}

function ScheduleInner() {
  const { schedule, nurses, mutate, refresh } = useNurseData();
  const [month, setMonth] = useState(currentMonthKey());
  const [preview, setPreview] = useState<(AutoScheduleResult & { month: string }) | null>(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [snapKey, setSnapKey] = useState(0);
  const existing = schedule[month];
  const existingDays = existing ? Object.keys(existing).length : 0;

  const compute = async () => {
    setComputing(true);
    try {
      // ดึงข้อมูลล่าสุดก่อนคำนวณ (เผื่อมีคนแก้ข้อมูลพยาบาล/วันลาระหว่างนี้)
      const d = await api<BootstrapData>("/api/bootstrap", { loginPath: "/login" });
      const res = autoSchedule({ month, nurses: d.nurses, schedule: d.schedule, leaves: d.leaves, holidays: d.holidays });
      setPreview({ ...res, month });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "คำนวณไม่สำเร็จ");
    }
    setComputing(false);
  };

  const save = async () => {
    if (!preview) return;
    const ok = await confirmDialog({
      title: `บันทึกตาราง ${monthTitleTH(preview.month)}`,
      message: existingDays ? (
        <>
          <Alert tone="warn" icon={<TriangleAlert />}>
            เดือนนี้มีตารางอยู่แล้ว <b>{existingDays} วัน ({slotsOf(existing)} กะ-คน)</b> — จะถูก<b>เขียนทับทั้งหมด</b> รวมถึงที่แก้เองรายวัน เวรกำหนดเอง และการแลกเวรที่อนุมัติไปแล้ว
          </Alert>
          <p className="text-sm">ตารางเดิมจะถูกสำรองไว้อัตโนมัติ กู้คืนได้ที่ส่วน “สำรองตารางเวร” ด้านล่าง</p>
        </>
      ) : (
        <p>บันทึกตารางใหม่ {preview.totalAssigned} กะ-คน</p>
      ),
      confirmText: existingDays ? "เขียนทับและบันทึก" : "บันทึก",
      tone: existingDays ? "danger" : "primary",
    });
    if (!ok) return;
    setSaving(true);
    const done = await mutate(
      () => api(`/api/schedule/${preview.month}`, { method: "PUT", body: { monthSchedule: preview.monthSchedule, warnings: preview.warnings } }),
      `บันทึกตาราง ${monthTitleTH(preview.month)} แล้ว`,
    );
    setSaving(false);
    if (done) {
      setPreview(null);
      setSnapKey((k) => k + 1);
    }
  };

  const clear = async () => {
    const ok = await confirmDialog({
      title: `ล้างตาราง ${monthTitleTH(month)}`,
      message: <p>ตารางเวรทั้งเดือน ({existingDays} วัน) จะถูกลบ — ระบบสำรองไว้อัตโนมัติก่อน กู้คืนได้ที่ส่วน “สำรองตารางเวร”</p>,
      confirmText: "ล้างตาราง",
      tone: "danger",
      typeToConfirm: "ล้าง",
    });
    if (ok && (await mutate(() => api(`/api/schedule/${month}`, { method: "DELETE" }), `ล้างตาราง ${monthTitleTH(month)} แล้ว`))) {
      setSnapKey((k) => k + 1);
    }
  };

  const onMonth = (m: string) => {
    setMonth(m);
    setPreview(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="จัดเวร" description="คำนวณตารางอัตโนมัติ ตรวจความเท่าเทียม แล้วจึงบันทึก" />

      <Card>
        <CardHeader icon={<WandSparkles className="size-5" />} title="จัดเวรอัตโนมัติ" />
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <MonthSwitcher value={month} onChange={onMonth} />
            <div className="text-sm sm:ml-auto">
              {existingDays ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="size-4" /> มีตารางแล้ว {existingDays} วัน
                </span>
              ) : (
                <span className="text-ink-soft">ยังไม่ได้จัดเวรเดือนนี้</span>
              )}
            </div>
          </div>

          <details className="group rounded-xl border border-line bg-canvas/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-ink">
              <Info className="size-4 text-brand-600" /> เงื่อนไขการจัดเวร
              <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="list-disc space-y-1.5 px-8 pb-3 text-sm leading-relaxed text-ink-soft">
              <li><b>วันธรรมดา:</b> ไม่มีกะเช้า / บ่าย 2 ทีม (6 คน) + Pre-op 1 คน / ดึก 1 ทีม (3 คน)</li>
              <li><b>วันหยุด:</b> เช้า 2 ทีม + Pre-op เช้า / บ่าย 2 ทีม + Pre-op บ่าย / ดึก 1 ทีม</li>
              <li>ทีมละ 3 คนคนละรุ่น · รุ่น 4 = Pre-op · Staff ได้เช้าวันหยุด 3 เวร/เดือน</li>
              <li>เฉลี่ยจำนวนเวรรวมในเดือนให้เท่ากันภายในรุ่น แล้วเฉลี่ยทีม 1/ทีม 2</li>
              <li><b>ห้ามบ่ายควบดึก</b> (บ่ายเมื่อวาน → ห้ามดึกวันนี้) · <b>ดึกห้ามติดกัน</b> (ติดได้เฉพาะเมื่อคนไม่พอ พร้อมคำเตือน) · เมื่อวานหยุดลงดึกได้</li>
              <li>บ่ายห้ามติดกัน 3 วัน · วันธรรมดา ดึก/บ่ายไม่ใช่คนเดียวกัน · วันหยุด 1 คน 1 เวร</li>
              <li>เคารพวันไม่สะดวก, Fix เวร และวันลาที่อนุมัติแล้ว · ลาพักร้อนทุก 3 วัน ลดโควตา 1 เวร</li>
            </ul>
          </details>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={compute} loading={computing} disabled={!nurses.length}>
              {!computing && <WandSparkles />} คำนวณตาราง {monthTitleTH(month)}
            </Button>
            {existingDays > 0 && (
              <Button size="lg" variant="danger-soft" onClick={clear}>
                <Trash2 /> ล้างตาราง
              </Button>
            )}
          </div>

          {preview && preview.month === month && (
            <div className="space-y-4 rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-ink">ผลการคำนวณ (ยังไม่บันทึก)</h3>
                  <p className="text-sm text-ink-soft">
                    {preview.totalAssigned} กะ-คน · คำเตือน {preview.warnings.length} รายการ
                  </p>
                </div>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  ยกเลิก
                </Button>
                <Button onClick={save} loading={saving}>
                  {!saving && <Save />} บันทึกตารางนี้
                </Button>
              </div>
              {preview.warnings.length > 0 && (
                <Alert tone="warn" icon={<TriangleAlert />}>
                  <div className="font-semibold">คำเตือน</div>
                  <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              <FairnessTable ms={preview.monthSchedule} nurses={nurses} />
            </div>
          )}

          {!preview && existing && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink">จำนวนเวรต่อคนของตารางปัจจุบัน</h3>
              <FairnessTable ms={existing} nurses={nurses} />
            </div>
          )}
        </CardBody>
      </Card>

      <SnapshotPanel month={month} reloadKey={snapKey} />

      <Card>
        <CardHeader
          icon={<CalendarPlus className="size-5" />}
          title="เพิ่มเวรกำหนดเอง"
          description="สร้างเวรพิเศษ เช่น ประชุม/อบรม กำหนดช่วงวัน แล้วเลือกคนเองหรือสุ่มจากคนที่ยังไม่มีเวร"
          actions={
            <Button variant="secondary" onClick={() => setCustomOpen(true)}>
              <CalendarPlus /> เพิ่มเวร
            </Button>
          }
        />
      </Card>
      {customOpen && <CustomShiftDialog month={month} onClose={() => setCustomOpen(false)} />}
    </div>
  );
}
