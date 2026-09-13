"use client";

import { Save, Trash2, TriangleAlert, WandSparkles } from "lucide-react";
import { useState } from "react";
import { useNAData } from "@/components/data/na-data";
import { RequireNAAdmin } from "@/components/shell/na-shell";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/form";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { currentMonthKey, monthTitleTH } from "@/lib/domain/dates";
import { DEFAULT_NA_HEADCOUNTS, NA_SHIFT_LABELS, autoScheduleNA, naCountMonth, type NAHeadcounts } from "@/lib/domain/na";
import type { MonthSchedule, NABootstrapData } from "@/lib/types";

export default function NASchedulePage() {
  return (
    <RequireNAAdmin>
      <Inner />
    </RequireNAAdmin>
  );
}

function Inner() {
  const { schedule, assistants, mutate, refresh } = useNAData();
  const [month, setMonth] = useState(currentMonthKey());
  const [counts, setCounts] = useState<NAHeadcounts>(DEFAULT_NA_HEADCOUNTS);
  const [preview, setPreview] = useState<{ month: string; ms: MonthSchedule; warnings: string[]; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = schedule[month];

  const compute = async () => {
    setBusy(true);
    try {
      const d = await api<NABootstrapData>("/api/na/bootstrap", { loginPath: "/na/login" });
      const r = autoScheduleNA({ month, assistants: d.assistants, leaves: d.leaves, holidays: d.holidays, headcounts: counts });
      setPreview({ month, ms: r.monthSchedule, warnings: r.warnings, total: r.totalAssigned });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "คำนวณไม่สำเร็จ");
    }
    setBusy(false);
  };

  const save = async () => {
    if (!preview) return;
    if (
      existing &&
      !(await confirmDialog({
        title: `เขียนทับตาราง NA ${monthTitleTH(month)}?`,
        message: <Alert tone="warn">ตารางเดิม {Object.keys(existing).length} วัน รวมการแลกเวรที่อนุมัติแล้ว จะถูกแทนที่ทั้งหมด</Alert>,
        confirmText: "เขียนทับและบันทึก",
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    if (await mutate(() => api(`/api/na/schedule/${preview.month}`, { method: "PUT", body: { monthSchedule: preview.ms, warnings: preview.warnings } }), "บันทึกตาราง NA แล้ว")) setPreview(null);
    setBusy(false);
  };

  const view = preview?.month === month ? preview.ms : existing;

  return (
    <div className="space-y-4">
      <PageHeader title="จัดเวร NA" />
      <Card>
        <CardHeader icon={<WandSparkles className="size-5" />} title="จัดเวรอัตโนมัติ" description="วันหยุด: เช้า/บ่าย/ดึก · วันธรรมดา: เช้าทำการ/บ่าย/ดึก · 1 คน 1 เวร/วัน · ห้ามบ่ายเมื่อวานแล้วลงดึก" />
        <CardBody className="space-y-4">
          <MonthSwitcher
            value={month}
            onChange={(m) => {
              setMonth(m);
              setPreview(null);
            }}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(counts) as (keyof NAHeadcounts)[]).map((k) => (
              <Field key={k} label={`กะ${NA_SHIFT_LABELS[k]} (คน)`}>
                <Input type="number" min={0} max={20} value={counts[k]} onChange={(e) => setCounts({ ...counts, [k]: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={compute} loading={busy} disabled={!assistants.length}>
              {!busy && <WandSparkles />} คำนวณตาราง {monthTitleTH(month)}
            </Button>
            {existing && !preview && (
              <Button
                size="lg"
                variant="danger-soft"
                onClick={async () => {
                  if (await confirmDialog({ title: "ล้างตาราง NA เดือนนี้?", confirmText: "ล้าง", tone: "danger", typeToConfirm: "ล้าง" }))
                    mutate(() => api(`/api/na/schedule/${month}`, { method: "DELETE" }), "ล้างตารางแล้ว");
                }}
              >
                <Trash2 /> ล้างตาราง
              </Button>
            )}
          </div>
          {preview?.month === month && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-brand-200 bg-brand-50/50 p-3">
              <span className="flex-1 text-sm">
                <b>ผลการคำนวณ (ยังไม่บันทึก)</b> · {preview.total} กะ-คน
              </span>
              <Button variant="outline" onClick={() => setPreview(null)}>
                ยกเลิก
              </Button>
              <Button onClick={save} loading={busy}>
                <Save /> บันทึกตารางนี้
              </Button>
            </div>
          )}
          {preview?.month === month && preview.warnings.length > 0 && (
            <Alert tone="warn" icon={<TriangleAlert />}>
              <ul className="list-disc pl-5">
                {preview.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
          {view && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 text-left">ชื่อ</th>
                    <th className="px-2 py-2">รวม</th>
                    <th className="px-2 py-2">เช้า</th>
                    <th className="px-2 py-2">บ่าย</th>
                    <th className="px-2 py-2">ดึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {assistants.map((a) => {
                    const c = naCountMonth(view, a.id);
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2">{a.name}</td>
                        <td className="px-2 py-2 text-center font-bold text-brand-700">{c.total}</td>
                        <td className="px-2 py-2 text-center">{c.morning + c.morning_workday}</td>
                        <td className="px-2 py-2 text-center">{c.afternoon}</td>
                        <td className="px-2 py-2 text-center">{c.night}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
