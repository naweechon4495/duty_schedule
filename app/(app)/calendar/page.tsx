"use client";

import { CalendarDays, FileSpreadsheet, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Agenda } from "@/components/calendar/agenda";
import { AllCell } from "@/components/calendar/cells";
import { DayDetail } from "@/components/calendar/day-detail";
import { MonthGrid } from "@/components/calendar/month-grid";
import { useNurseData } from "@/components/data/nurse-data";
import { SHIFT_DOT_CLASS } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { ChoiceChip, Select } from "@/components/ui/form";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { toast } from "@/components/ui/toast";
import { currentMonthKey, monthTitleTH } from "@/lib/domain/dates";
import { GENERATIONS, GEN_LABELS } from "@/lib/domain/schedule";
import { exportScheduleCsv, exportScheduleMatrix } from "@/lib/export/schedule";
import { cn } from "@/lib/utils";

const TONES: [string, string][] = [
  ["morning", "เช้า"],
  ["afternoon", "บ่าย"],
  ["night", "ดึก"],
  ["preop", "Pre-op"],
  ["custom", "เวรกำหนดเอง"],
];

export default function CalendarPage() {
  const { schedule, nurses, nurseById, cal } = useNurseData();
  const [month, setMonth] = useState(currentMonthKey());
  const [detail, setDetail] = useState<string | null>(null);
  const [gen, setGen] = useState("");
  const [tones, setTones] = useState<Set<string>>(new Set(TONES.map(([t]) => t)));
  const [exporting, setExporting] = useState(false);
  const ms = schedule[month];

  const filter = useMemo(() => (gen ? (id: string) => nurseById.get(id)?.generation === gen : undefined), [gen, nurseById]);
  const toggleTone = (t: string, on: boolean) =>
    setTones((prev) => {
      const next = new Set(prev);
      if (on) next.add(t);
      else next.delete(t);
      return next;
    });

  const exportExcel = async () => {
    setExporting(true);
    try {
      await exportScheduleMatrix(month, nurses, schedule, cal);
    } catch (e) {
      toast.error("Export ไม่สำเร็จ: " + (e instanceof Error ? e.message : e));
    }
    setExporting(false);
  };

  return (
    <div>
      <PageHeader
        title="ปฏิทินเวร"
        description={monthTitleTH(month) + (ms ? ` · จัดแล้ว ${Object.keys(ms).length} วัน` : " · ยังไม่ได้จัดเวร")}
        actions={
          <>
            <Button variant="outline" onClick={exportExcel} loading={exporting}>
              {!exporting && <FileSpreadsheet />} Excel
            </Button>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={() => exportScheduleCsv(month, nurses, schedule, cal)}>
              <FileText /> CSV
            </Button>
            <Link href={`/calendar/print?month=${month}`} target="_blank" className={cn(buttonVariants({ variant: "outline" }))}>
              <Printer /> พิมพ์ / PDF
            </Link>
          </>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <MonthSwitcher value={month} onChange={setMonth} />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Select value={gen} onChange={(e) => setGen(e.target.value)} className="w-36" aria-label="กรองตามรุ่น">
                <option value="">ทุกรุ่น</option>
                {GENERATIONS.map((g) => (
                  <option key={g} value={g}>
                    {GEN_LABELS[g]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามกะ">
            {TONES.map(([t, label]) => (
              <ChoiceChip key={t} checked={tones.has(t)} onChange={(on) => toggleTone(t, on)}>
                <span className={cn("size-2.5 rounded-full", SHIFT_DOT_CLASS[t as keyof typeof SHIFT_DOT_CLASS])} />
                {label}
              </ChoiceChip>
            ))}
          </div>

          {!ms && (
            <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm text-ink-soft">
              <CalendarDays className="size-4" /> เดือนนี้ยังไม่ได้จัดเวร
            </div>
          )}

          <div className="hidden md:block">
            <MonthGrid
              month={month}
              cal={cal}
              onSelect={setDetail}
              renderCell={(date) => <AllCell ds={ms?.[Number(date.slice(8))]} nurseById={nurseById} filter={filter} tones={tones} />}
            />
          </div>
          <div className="md:hidden">
            <Agenda
              month={month}
              cal={cal}
              onSelect={setDetail}
              renderDay={(date) => <AllCell mode="names" ds={ms?.[Number(date.slice(8))]} nurseById={nurseById} filter={filter} tones={tones} />}
            />
          </div>
        </CardBody>
      </Card>
      {detail && <DayDetail date={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
