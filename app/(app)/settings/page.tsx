"use client";

import { Database, Download, Info, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { RequirePage } from "@/components/shell/nurse-shell";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { todayStr } from "@/lib/domain/dates";
import { downloadBlob } from "@/lib/export/download";

export default function SettingsPage() {
  return (
    <RequirePage page="settings">
      <SettingsInner />
    </RequirePage>
  );
}

function SettingsInner() {
  const { nurses, schedule, swaps, leaves, holidays, users, mutate } = useNurseData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const data = await api("/api/backup");
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `สำรองข้อมูลเวร_${todayStr()}.json`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export ไม่สำเร็จ");
    }
    setBusy(false);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.nurses)) throw new Error("ไม่ใช่ไฟล์สำรองของระบบนี้");
      const ok = await confirmDialog({
        title: "นำเข้าข้อมูลสำรอง",
        message: (
          <Alert tone="warn">
            ข้อมูลปัจจุบัน <b>พยาบาล ตารางเวร คำขอแลกเวร วันลา และวันหยุดพิเศษ ทั้งหมด</b> จะถูกแทนที่ด้วยข้อมูลในไฟล์ ({data.nurses.length} คน,{" "}
            {Object.keys(data.schedule || {}).length} เดือน) — บัญชีผู้ใช้ไม่ถูกแตะ
          </Alert>
        ),
        confirmText: "นำเข้าและแทนที่",
        tone: "danger",
        typeToConfirm: "ยืนยัน",
      });
      if (ok) await mutate(() => api("/api/backup", { body: { confirm: "ยืนยัน", data } }), "นำเข้าข้อมูลสำรองแล้ว");
    } catch (e) {
      toast.error("ไฟล์ไม่ถูกต้อง: " + (e instanceof Error ? e.message : e));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const stats = [
    ["พยาบาล", nurses.length + " คน"],
    ["เดือนที่มีตาราง", Object.keys(schedule).length + " เดือน"],
    ["คำขอแลกเวร", swaps.length + " รายการ"],
    ["คำขอลา", leaves.length + " รายการ"],
    ["วันหยุดพิเศษ", holidays.length + " วัน"],
    ["ผู้ใช้ระบบ", users.length + " บัญชี"],
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="ตั้งค่า" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Database className="size-5" />} title="สำรอง / กู้คืนข้อมูล" description="ข้อมูลเก็บในฐานข้อมูล Cloudflare D1 ทุกการแก้ไขบันทึกลง Log" />
          <CardBody className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={exportBackup} loading={busy}>
              {!busy && <Download />} ดาวน์โหลดไฟล์สำรอง (JSON)
            </Button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importBackup(e.target.files?.[0])} />
            <Button variant="danger-soft" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
              <Upload /> นำเข้าไฟล์สำรอง (แทนที่ข้อมูลปัจจุบัน)
            </Button>
            <p className="text-xs text-ink-mute">ไฟล์สำรองไม่มีรหัสผ่านผู้ใช้</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Info className="size-5" />} title="ข้อมูลในระบบ" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-2">
              {stats.map(([k, v]) => (
                <div key={k} className="rounded-xl bg-canvas p-3">
                  <dt className="text-xs text-ink-soft">{k}</dt>
                  <dd className="text-lg font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
