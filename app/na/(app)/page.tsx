"use client";

import { ArrowLeftRight, CalendarCheck2, ChevronRight, Palmtree, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Agenda } from "@/components/calendar/agenda";
import { MonthGrid } from "@/components/calendar/month-grid";
import { useNAData } from "@/components/data/na-data";
import { NAAllCell, NADayDetail, NAPersonCell } from "@/components/na/na-cells";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { currentMonthKey, dateStrOf, dateTH, daysInMonth, monthTitleTH, todayStr } from "@/lib/domain/dates";
import { naCountMonth, naIsOnLeave } from "@/lib/domain/na";
import { cn } from "@/lib/utils";

export default function NAHomePage() {
  const { me, mine, isAdmin, assistants, schedule, swaps, leaves, byId, cal } = useNAData();
  const [month, setMonth] = useState(currentMonthKey());
  const [person, setPerson] = useState(mine ? mine.id : "__all__");
  const [detail, setDetail] = useState<string | null>(null);
  const target = person === "__all__" ? null : byId.get(person) || null;
  const ms = schedule[month];

  const items = useMemo(
    () => [
      { value: "__all__", label: "ทุกคน (ตารางรวม)" },
      ...assistants
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
        .map((a) => ({ value: a.id, label: (a.id === mine?.id ? "เวรของฉัน — " : `${a.code} `) + a.name })),
    ],
    [assistants, mine],
  );
  const leaveOn = (id: string, date: string) => leaves.find((l) => l.assistantId === id && l.status === "approved" && date >= l.dateFrom && date <= l.dateTo);
  const c = target ? naCountMonth(ms, target.id) : null;
  let leaveDays = 0;
  if (target) for (let d = 1; d <= daysInMonth(month); d++) if (naIsOnLeave(leaves, target.id, dateStrOf(month, d))) leaveDays++;

  const cell = (date: string, names: boolean) => {
    const ds = ms?.[Number(date.slice(8))];
    return target ? <NAPersonCell ds={ds} id={target.id} leave={leaveOn(target.id, date)} /> : <NAAllCell ds={ds} byId={byId} mode={names ? "names" : "auto"} />;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <p className="text-sm text-ink-soft">{dateTH(todayStr(), true)}</p>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">สวัสดี, {me.fullname}</h1>
      </div>

      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/na/swap", icon: <ArrowLeftRight />, label: "คำขอแลกเวรรออนุมัติ", n: swaps.filter((s) => s.status === "pending").length },
            { href: "/na/leave", icon: <Palmtree />, label: "คำขอลารออนุมัติ", n: leaves.filter((l) => l.status === "pending").length },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-brand-300">
              <span className={cn("grid size-11 place-items-center rounded-xl [&_svg]:size-5", q.n ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-800")}>{q.icon}</span>
              <span className="flex-1">
                <span className="block text-sm text-ink-soft">{q.label}</span>
                <span className="block text-2xl font-bold">{q.n} รายการ</span>
              </span>
              <ChevronRight className="size-5 text-ink-mute" />
            </Link>
          ))}
        </div>
      )}

      {me.role === "assistant" && !mine && (
        <Alert tone="warn" icon={<TriangleAlert />}>
          บัญชีของคุณยังไม่ได้ผูกกับรายชื่อ NA — กรุณาแจ้งผู้ดูแลระบบ
        </Alert>
      )}

      <Card>
        <CardHeader icon={<CalendarCheck2 className="size-5" />} title={target ? (target.id === mine?.id ? "ตารางเวรของฉัน" : "ตารางเวรของ " + target.name) : "ตารางเวรรวม"} description={monthTitleTH(month)} />
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-80">
              <Combobox items={items} value={person} onChange={setPerson} />
            </div>
            <MonthSwitcher value={month} onChange={setMonth} className="sm:ml-auto" />
          </div>
          {c && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {[
                ["รวมทั้งเดือน", c.total],
                ["เช้า", c.morning + c.morning_workday],
                ["บ่าย", c.afternoon],
                ["ดึก", c.night],
                ["วันลา", leaveDays],
              ].map(([l, v], i) => (
                <div key={l} className={cn("rounded-xl border border-line p-2.5 text-center", i === 0 && "border-brand-200 bg-brand-50")}>
                  <div className={cn("text-2xl font-bold", i === 0 && "text-brand-700")}>{v}</div>
                  <div className="text-xs font-semibold text-ink-soft">{l}</div>
                </div>
              ))}
            </div>
          )}
          <div className="hidden md:block">
            <MonthGrid month={month} cal={cal} onSelect={setDetail} minCellHeight={target ? "min-h-20" : "min-h-24"} renderCell={(d) => cell(d, false)} />
          </div>
          <div className="md:hidden">
            <Agenda month={month} cal={cal} onSelect={setDetail} renderDay={(d) => cell(d, true)} />
          </div>
        </CardBody>
      </Card>
      {detail && <NADayDetail date={detail} ds={schedule[detail.slice(0, 7)]?.[Number(detail.slice(8))]} byId={byId} cal={cal} leaves={leaves} onClose={() => setDetail(null)} />}
    </div>
  );
}
