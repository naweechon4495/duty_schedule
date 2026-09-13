"use client";

import { History, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DateShift, MonthShift, Nurse, WeekRef, WeekShift } from "@/lib/types";
import { useNurseData } from "@/components/data/nurse-data";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input, Select } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { WEEKDAY_TH, dateTH, getWeekNumber, monthShortTH, yearOf } from "@/lib/domain/dates";
import { GENERATIONS, GEN_LABELS, SHIFT_LABELS } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

const CONSTRAINT_SHIFTS = ["morning", "afternoon", "night", "preop"];
const FIX_SHIFTS = ["morning", "afternoon", "night", "preop", "preop_morning", "preop_afternoon"];

export function emptyNurse(): Nurse {
  return {
    id: "",
    code: "",
    name: "",
    generation: "1",
    phone: "",
    unavailableDates: [],
    unavailableWeekdays: [],
    unavailableShifts: [],
    unavailableWeeks: [],
    unavailableMonths: [],
    unavailableShiftsInWeeks: [],
    unavailableShiftsInMonths: [],
    unavailableHolidays: [],
    fixedShifts: [],
  };
}

export function constraintCount(n: Nurse) {
  return (
    n.unavailableDates.length +
    n.unavailableWeekdays.length +
    n.unavailableShifts.length +
    n.unavailableWeeks.length +
    n.unavailableMonths.length +
    n.unavailableShiftsInWeeks.length +
    n.unavailableShiftsInMonths.length +
    n.unavailableHolidays.length
  );
}

function Tag({ children, onRemove, tone = "slate" }: { children: React.ReactNode; onRemove: () => void; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-800",
    rose: "bg-rose-100 text-rose-800",
    amber: "bg-amber-100 text-amber-900",
    sky: "bg-sky-100 text-sky-900",
    emerald: "bg-emerald-100 text-emerald-900",
  };
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1 rounded-full pr-1 pl-3 text-sm font-medium", tones[tone])}>
      {children}
      <button type="button" onClick={onRemove} className="grid size-7 place-items-center rounded-full hover:bg-black/10" aria-label="ลบรายการ">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-line p-3">
      <div>
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        {hint && <p className="text-xs text-ink-mute">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function AddRow({ children, onAdd, disabled }: { children: React.ReactNode; onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {children}
      <Button variant="secondary" onClick={onAdd} disabled={disabled}>
        <Plus /> เพิ่ม
      </Button>
    </div>
  );
}

export function NurseDialog({ nurse, onClose }: { nurse: Nurse | null; onClose: () => void }) {
  const { mutate, cal } = useNurseData();
  const [n, setN] = useState<Nurse>(nurse ? structuredClone(nurse) : emptyNurse());
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("info");
  // ช่องกรอกชั่วคราว
  const [d1, setD1] = useState("");
  const [holiday, setHoliday] = useState("");
  const [weekDate, setWeekDate] = useState("");
  const [monthIn, setMonthIn] = useState("");
  const [sDate, setSDate] = useState("");
  const [sShift, setSShift] = useState("night");
  const [swDate, setSwDate] = useState("");
  const [swShift, setSwShift] = useState("night");
  const [smMonth, setSmMonth] = useState("");
  const [smShift, setSmShift] = useState("night");
  const [fDate, setFDate] = useState("");
  const [fShift, setFShift] = useState("afternoon");

  const set = <K extends keyof Nurse>(k: K, v: Nurse[K]) => setN((p) => ({ ...p, [k]: v }));
  const dup = (msg = "มีรายการนี้อยู่แล้ว") => toast.warn(msg);
  const holidays = cal.all();

  const save = async () => {
    setSaving(true);
    const ok = await mutate(
      () => (nurse ? api(`/api/nurses/${nurse.id}`, { method: "PUT", body: n }) : api("/api/nurses", { body: n })),
      nurse ? "บันทึกข้อมูลพยาบาลแล้ว" : "เพิ่มพยาบาลแล้ว",
    );
    setSaving(false);
    if (ok) onClose();
  };

  const count = constraintCount(n);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={nurse ? `แก้ไข ${nurse.name}` : "เพิ่มพยาบาล"}
      description={nurse ? `รหัส ${nurse.code}` : undefined}
      size="lg"
      footer={
        <>
          {nurse && (
            <Link href={`/logs?entity=nurse&entityId=${nurse.id}`} className="mr-auto hidden items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline sm:inline-flex">
              <History className="size-4" /> ประวัติการแก้ไข
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} loading={saving} disabled={!n.code.trim() || !n.name.trim()}>
            บันทึก
          </Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">ข้อมูล</TabsTrigger>
          <TabsTrigger value="day">ไม่สะดวกทั้งวัน</TabsTrigger>
          <TabsTrigger value="shift">ไม่สะดวกบางกะ</TabsTrigger>
          <TabsTrigger value="fix">Fix เวร {n.fixedShifts.length > 0 && `(${n.fixedShifts.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="รหัสพนักงาน *">
              <Input value={n.code} onChange={(e) => set("code", e.target.value)} placeholder="เช่น N001" />
            </Field>
            <Field label="เบอร์โทรศัพท์">
              <Input type="tel" inputMode="tel" value={n.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08x-xxx-xxxx" />
            </Field>
            <Field label="ชื่อ-นามสกุล *" className="sm:col-span-2">
              <Input value={n.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
          </div>
          <Field label="รุ่น *" hint="รุ่น 4 = Pre-op · Staff = เช้าวันหยุด 3 เวร/เดือน">
            <div className="flex flex-wrap gap-2">
              {GENERATIONS.map((g) => (
                <ChoiceChip key={g} type="radio" name="gen" checked={n.generation === g} onChange={() => set("generation", g)}>
                  {GEN_LABELS[g]}
                </ChoiceChip>
              ))}
            </div>
          </Field>
          {count > 0 && <p className="text-sm text-ink-soft">มีข้อจำกัดวัน/กะ {count} รายการ · Fix เวร {n.fixedShifts.length} รายการ</p>}
        </TabsContent>

        <TabsContent value="day" className="space-y-3">
          <Section title="วันในสัปดาห์ (ซ้ำทุกสัปดาห์)">
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_TH.map((w, i) => (
                <ChoiceChip
                  key={w}
                  checked={n.unavailableWeekdays.includes(i)}
                  onChange={(on) => set("unavailableWeekdays", on ? [...n.unavailableWeekdays, i].sort() : n.unavailableWeekdays.filter((x) => x !== i))}
                >
                  {w}
                </ChoiceChip>
              ))}
            </div>
          </Section>
          <Section title="วันที่เฉพาะเจาะจง">
            <AddRow
              disabled={!d1}
              onAdd={() => {
                if (n.unavailableDates.includes(d1)) return dup();
                set("unavailableDates", [...n.unavailableDates, d1].sort());
                setD1("");
              }}
            >
              <Input type="date" value={d1} onChange={(e) => setD1(e.target.value)} className="w-auto flex-1" />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.unavailableDates.map((d) => (
                <Tag key={d} tone="rose" onRemove={() => set("unavailableDates", n.unavailableDates.filter((x) => x !== d))}>
                  {dateTH(d)}
                </Tag>
              ))}
            </div>
          </Section>
          <Section title="วันหยุดนักขัตฤกษ์ / วันหยุดพิเศษ">
            <AddRow
              disabled={!holiday}
              onAdd={() => {
                if (n.unavailableHolidays.includes(holiday)) return dup();
                set("unavailableHolidays", [...n.unavailableHolidays, holiday].sort());
                setHoliday("");
              }}
            >
              <Select value={holiday} onChange={(e) => setHoliday(e.target.value)} className="w-auto min-w-0 flex-1">
                <option value="">— เลือกวันหยุด —</option>
                {holidays.map((h) => (
                  <option key={h.date} value={h.date}>
                    {dateTH(h.date)} {h.name}
                  </option>
                ))}
              </Select>
            </AddRow>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const all = new Set([...n.unavailableHolidays, ...holidays.map((h) => h.date)]);
                  set("unavailableHolidays", [...all].sort());
                }}
              >
                เพิ่มวันหยุดทั้งหมด
              </Button>
              {n.unavailableHolidays.length > 0 && (
                <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => set("unavailableHolidays", [])}>
                  ล้างทั้งหมด ({n.unavailableHolidays.length})
                </Button>
              )}
            </div>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {n.unavailableHolidays.map((d) => (
                <Tag key={d} tone="emerald" onRemove={() => set("unavailableHolidays", n.unavailableHolidays.filter((x) => x !== d))}>
                  {dateTH(d)} {cal.holidayName(d)}
                </Tag>
              ))}
            </div>
          </Section>
          <Section title="ทั้งสัปดาห์" hint="เลือกวันใดก็ได้ในสัปดาห์นั้น">
            <AddRow
              disabled={!weekDate}
              onAdd={() => {
                const w: WeekRef = { year: yearOf(weekDate), week: getWeekNumber(weekDate), refDate: weekDate };
                if (n.unavailableWeeks.some((x) => x.year === w.year && x.week === w.week)) return dup();
                set("unavailableWeeks", [...n.unavailableWeeks, w].sort((a, b) => a.year - b.year || a.week - b.week));
                setWeekDate("");
              }}
            >
              <Input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} className="w-auto flex-1" />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.unavailableWeeks.map((w, i) => (
                <Tag key={i} tone="sky" onRemove={() => set("unavailableWeeks", n.unavailableWeeks.filter((_, j) => j !== i))}>
                  สัปดาห์ที่ {w.week}/{w.year + 543}
                </Tag>
              ))}
            </div>
          </Section>
          <Section title="ทั้งเดือน">
            <AddRow
              disabled={!monthIn}
              onAdd={() => {
                if (n.unavailableMonths.includes(monthIn)) return dup();
                set("unavailableMonths", [...n.unavailableMonths, monthIn].sort());
                setMonthIn("");
              }}
            >
              <Input type="month" value={monthIn} onChange={(e) => setMonthIn(e.target.value)} className="w-auto flex-1" />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.unavailableMonths.map((m) => (
                <Tag key={m} tone="amber" onRemove={() => set("unavailableMonths", n.unavailableMonths.filter((x) => x !== m))}>
                  {monthShortTH(m)}
                </Tag>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="shift" className="space-y-3">
          <Section title="วันที่ + กะ">
            <AddRow
              disabled={!sDate}
              onAdd={() => {
                if (n.unavailableShifts.some((x) => x.date === sDate && x.shift === sShift)) return dup();
                set("unavailableShifts", [...n.unavailableShifts, { date: sDate, shift: sShift } as DateShift].sort((a, b) => a.date.localeCompare(b.date)));
                setSDate("");
              }}
            >
              <Input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} className="w-auto flex-1" />
              <ShiftSelect value={sShift} onChange={setSShift} options={CONSTRAINT_SHIFTS} />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.unavailableShifts.map((s, i) => (
                <Tag key={i} tone="rose" onRemove={() => set("unavailableShifts", n.unavailableShifts.filter((_, j) => j !== i))}>
                  {dateTH(s.date)} {SHIFT_LABELS[s.shift]}
                </Tag>
              ))}
            </div>
          </Section>
          <Section title="สัปดาห์ + กะ">
            <AddRow
              disabled={!swDate}
              onAdd={() => {
                const w: WeekShift = { year: yearOf(swDate), week: getWeekNumber(swDate), shift: swShift, refDate: swDate };
                if (n.unavailableShiftsInWeeks.some((x) => x.year === w.year && x.week === w.week && x.shift === w.shift)) return dup();
                set("unavailableShiftsInWeeks", [...n.unavailableShiftsInWeeks, w]);
                setSwDate("");
              }}
            >
              <Input type="date" value={swDate} onChange={(e) => setSwDate(e.target.value)} className="w-auto flex-1" />
              <ShiftSelect value={swShift} onChange={setSwShift} options={CONSTRAINT_SHIFTS} />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.unavailableShiftsInWeeks.map((w, i) => (
                <Tag key={i} tone="sky" onRemove={() => set("unavailableShiftsInWeeks", n.unavailableShiftsInWeeks.filter((_, j) => j !== i))}>
                  สัปดาห์ที่ {w.week}/{w.year + 543} {SHIFT_LABELS[w.shift]}
                </Tag>
              ))}
            </div>
          </Section>
          <Section title="เดือน + กะ">
            <AddRow
              disabled={!smMonth}
              onAdd={() => {
                if (n.unavailableShiftsInMonths.some((x) => x.month === smMonth && x.shift === smShift)) return dup();
                set("unavailableShiftsInMonths", [...n.unavailableShiftsInMonths, { month: smMonth, shift: smShift } as MonthShift]);
                setSmMonth("");
              }}
            >
              <Input type="month" value={smMonth} onChange={(e) => setSmMonth(e.target.value)} className="w-auto flex-1" />
              <ShiftSelect value={smShift} onChange={setSmShift} options={CONSTRAINT_SHIFTS} />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.unavailableShiftsInMonths.map((m, i) => (
                <Tag key={i} tone="amber" onRemove={() => set("unavailableShiftsInMonths", n.unavailableShiftsInMonths.filter((_, j) => j !== i))}>
                  {monthShortTH(m.month)} {SHIFT_LABELS[m.shift]}
                </Tag>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="fix" className="space-y-3">
          <Section title="Fix เวร (ล็อกให้ได้เวรนี้แน่นอน)" hint="ระบบจัดเวรอัตโนมัติจะใส่คนนี้ในกะที่ระบุก่อนเสมอ">
            <AddRow
              disabled={!fDate}
              onAdd={() => {
                if (n.fixedShifts.some((x) => x.date === fDate && x.shift === fShift)) return dup();
                set("fixedShifts", [...n.fixedShifts, { date: fDate, shift: fShift }].sort((a, b) => a.date.localeCompare(b.date)));
                setFDate("");
              }}
            >
              <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="w-auto flex-1" />
              <ShiftSelect value={fShift} onChange={setFShift} options={FIX_SHIFTS} />
            </AddRow>
            <div className="flex flex-wrap gap-1.5">
              {n.fixedShifts.map((s, i) => (
                <Tag key={i} tone="emerald" onRemove={() => set("fixedShifts", n.fixedShifts.filter((_, j) => j !== i))}>
                  {dateTH(s.date)} {SHIFT_LABELS[s.shift]}
                </Tag>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </Dialog>
  );
}

function ShiftSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-36">
      {options.map((s) => (
        <option key={s} value={s}>
          {SHIFT_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
