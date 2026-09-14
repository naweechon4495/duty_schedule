"use client";

import { ArrowLeftRight, CalendarCheck2, ChevronRight, Palmtree, TriangleAlert, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Agenda } from "@/components/calendar/agenda";
import { AllCell, PersonCell, PersonMiniCell, ShiftLegend } from "@/components/calendar/cells";
import { DayDetail } from "@/components/calendar/day-detail";
import { MonthGrid } from "@/components/calendar/month-grid";
import { useNurseData } from "@/components/data/nurse-data";
import { GenBadge, ShiftChip } from "@/components/ui/badge";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { addDays, addMonths, currentMonthKey, dateStrOf, dateTH, daysInMonth, monthTitleTH, todayStr } from "@/lib/domain/dates";
import { personDayShifts } from "@/lib/domain/display";
import { countMonth, getDay, hasAnyShift } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const data = useNurseData();
  const { me, nurses, schedule, swaps, leaves, cal, myNurse, nurseById } = data;
  const [month, setMonth] = useState(currentMonthKey());
  const [person, setPerson] = useState<string>(myNurse ? myNurse.id : "__all__");
  const [detail, setDetail] = useState<string | null>(null);

  const approver = me.role === "admin" || me.role === "approver";
  const pendingSwaps = swaps.filter((s) => s.status === "pending").length;
  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const target = person === "__all__" ? null : nurseById.get(person) || null;
  const ms = schedule[month];

  const personItems = useMemo(
    () => [
      { value: "__all__", label: "ทุกคน (ตารางรวม)" },
      ...(myNurse ? [{ value: myNurse.id, label: `เวรของฉัน — ${myNurse.name}` }] : []),
      ...nurses
        .filter((n) => n.id !== myNurse?.id)
        .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
        .map((n) => ({ value: n.id, label: `${n.code} ${n.name}`, hint: `รุ่น ${n.generation}` })),
    ],
    [nurses, myNurse],
  );

  const leaveOn = (id: string, date: string) => leaves.find((l) => l.nurseId === id && l.status === "approved" && date >= l.dateFrom && date <= l.dateTo);

  const summary = useMemo(() => {
    if (!target) return null;
    const c = countMonth(ms, target.id);
    let rest = 0;
    let leaveDays = 0;
    for (let d = 1; d <= daysInMonth(month); d++) {
      const date = dateStrOf(month, d);
      if (leaveOn(target.id, date)) leaveDays++;
      if (cal.isOffDay(date) && !hasAnyShift(ms?.[d], target.id)) rest++;
    }
    return { ...c, rest, leaveDays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms, month, cal, leaves]);

  const upcoming = useMemo(() => {
    if (!target) return [];
    const out: { date: string; shifts: ReturnType<typeof personDayShifts> }[] = [];
    for (let i = 0; i < 14 && out.length < 5; i++) {
      const date = addDays(todayStr(), i);
      const shifts = personDayShifts(getDay(schedule, date), target.id);
      if (shifts.length) out.push({ date, shifts });
    }
    return out;
  }, [target, schedule]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <p className="text-sm text-ink-soft">{dateTH(todayStr(), true)}</p>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">
          {greet}, {me.fullname}
        </h1>
      </div>

      {/* งานที่ต้องทำ */}
      {(approver || me.role === "admin") && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {approver && (
            <QuickCard href="/swap" icon={<ArrowLeftRight />} label="คำขอแลกเวรรออนุมัติ" value={pendingSwaps} tone={pendingSwaps ? "warn" : "ok"} />
          )}
          {approver && <QuickCard href="/leave" icon={<Palmtree />} label="คำขอลารออนุมัติ" value={pendingLeaves} tone={pendingLeaves ? "warn" : "ok"} />}
          {approver && <MonthStatus months={[currentMonthKey(), addMonths(currentMonthKey(), 1)]} />}
        </div>
      )}

      {me.role === "requester" && !myNurse && (
        <Alert tone="warn" icon={<TriangleAlert />}>
          บัญชีของคุณยังไม่ได้ผูกกับรายชื่อพยาบาล จึงแสดงตารางรวมแทน — กรุณาแจ้งผู้ดูแลระบบให้ผูกรหัสพยาบาล
        </Alert>
      )}

      <Card>
        <CardHeader
          icon={<CalendarCheck2 className="size-5" />}
          title={target ? (target.id === myNurse?.id ? "ตารางเวรของฉัน" : "ตารางเวรของ " + target.name) : "ตารางเวรรวม"}
          description={monthTitleTH(month)}
        />
        <CardBody className="space-y-4 max-[359px]:px-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-80">
              <Combobox items={personItems} value={person} onChange={setPerson} />
            </div>
            <MonthSwitcher value={month} onChange={setMonth} className="sm:ml-auto" />
          </div>

          {target && summary && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50/60 px-3 py-2.5">
                <span className="font-semibold text-ink">{target.name}</span>
                <GenBadge gen={target.generation} />
                <span className="text-sm text-ink-soft">รหัส {target.code}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                <Stat label="รวมทั้งเดือน" value={summary.total} strong />
                <Stat label="เช้า" value={summary.morning} tone="bg-amber-400" />
                <Stat label="บ่าย" value={summary.afternoon} tone="bg-sky-500" />
                <Stat label="ดึก" value={summary.night} tone="bg-slate-700" sub={summary.oncall ? `On call ${summary.oncall}` : undefined} />
                <Stat label="Pre-op" value={summary.preop} tone="bg-violet-500" />
                <Stat label="วันหยุดพัก" value={summary.rest} />
                <Stat label="วันลา" value={summary.leaveDays} tone="bg-orange-400" />
              </div>
              {upcoming.length > 0 && month === currentMonthKey() && (
                <div className="md:hidden">
                  <h3 className="mb-2 text-sm font-bold text-ink">เวรที่กำลังจะถึง</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {upcoming.map((u) => (
                      <button key={u.date} onClick={() => setDetail(u.date)} className="min-w-28 shrink-0 rounded-xl border border-line bg-surface p-2.5 text-left">
                        <div className="text-xs text-ink-soft">{u.date === todayStr() ? "วันนี้" : dateTH(u.date, true).split(" ").slice(0, 3).join(" ")}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.shifts.map((s, i) => (
                            <ShiftChip key={i} tone={s.tone}>
                              {s.label}
                            </ShiftChip>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <ShiftLegend />

          <div className="hidden md:block">
            <MonthGrid
              month={month}
              cal={cal}
              onSelect={setDetail}
              minCellHeight={target ? "min-h-20" : "min-h-28"}
              renderCell={(date) => {
                const ds = ms?.[Number(date.slice(8))];
                return target ? (
                  <PersonCell ds={ds} personId={target.id} leave={leaveOn(target.id, date)} workday={!cal.isOffDay(date)} />
                ) : (
                  <AllCell ds={ds} nurseById={nurseById} />
                );
              }}
              cellClassName={(date) => (target && hasAnyShift(ms?.[Number(date.slice(8))], target.id) ? "bg-brand-50/70 border-brand-200" : undefined)}
            />
          </div>
          {/* มือถือ: คนเดียว = ปฏิทินเดือน, ตารางรวม = รายการทีละวันพร้อมรายชื่อ */}
          {target ? (
            <div className="space-y-2 md:hidden">
              {!ms && <p className="rounded-xl bg-canvas px-3 py-2.5 text-sm text-ink-soft">เดือนนี้ยังไม่ได้จัดเวร</p>}
              <MonthGrid
                compact
                month={month}
                cal={cal}
                onSelect={setDetail}
                minCellHeight="min-h-14"
                renderCell={(date) => (
                  <PersonMiniCell ds={ms?.[Number(date.slice(8))]} personId={target.id} leave={leaveOn(target.id, date)} workday={!cal.isOffDay(date)} />
                )}
              />
              <p className="text-center text-xs text-ink-mute">กดที่วันเพื่อดูรายชื่อเวรทั้งหมดของวันนั้น</p>
            </div>
          ) : (
            <div className="md:hidden">
              <Agenda
                month={month}
                cal={cal}
                onSelect={setDetail}
                renderDay={(date) => <AllCell mode="names" ds={ms?.[Number(date.slice(8))]} nurseById={nurseById} />}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {detail && <DayDetail date={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Stat({ label, value, tone, strong, sub }: { label: string; value: number; tone?: string; strong?: boolean; sub?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-2.5 text-center", strong && "border-brand-200 bg-brand-50")}>
      <div className={cn("text-2xl leading-tight font-bold", strong ? "text-brand-700" : "text-ink")}>{value}</div>
      <div className="flex items-center justify-center gap-1 text-xs font-semibold text-ink-soft">
        {tone && <span className={cn("size-2 rounded-full", tone)} />}
        {label}
      </div>
      {sub && <div className="text-[11px] text-ink-mute">{sub}</div>}
    </div>
  );
}

function QuickCard({ href, icon, label, value, tone }: { href: string; icon: React.ReactNode; label: string; value: number; tone: "warn" | "ok" }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-brand-300">
      <span className={cn("grid size-11 place-items-center rounded-xl [&_svg]:size-5", tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink-soft">{label}</span>
        <span className="block text-2xl font-bold text-ink">{value} รายการ</span>
      </span>
      <ChevronRight className="size-5 text-ink-mute group-hover:text-brand-600" />
    </Link>
  );
}

function MonthStatus({ months }: { months: string[] }) {
  const { schedule } = useNurseData();
  return (
    <Link href="/schedule" className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-brand-300">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-800 [&_svg]:size-5">
        <WandSparkles />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm text-ink-soft">สถานะการจัดเวร</span>
        {months.map((m) => {
          const n = Object.keys(schedule[m] || {}).length;
          return (
            <span key={m} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">{monthTitleTH(m)}</span>
              <span className={n ? "text-emerald-700" : "text-amber-700"}>{n ? `จัดแล้ว ${n} วัน` : "ยังไม่จัด"}</span>
            </span>
          );
        })}
      </span>
      <ChevronRight className="size-5 text-ink-mute group-hover:text-brand-600" />
    </Link>
  );
}
