"use client";

import { useState } from "react";
import { useNAData } from "@/components/data/na-data";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { currentMonthKey, dateStrOf, daysInMonth } from "@/lib/domain/dates";
import { naCountMonth, naHasAnyShift } from "@/lib/domain/na";

export default function NAStatsPage() {
  const { assistants, schedule, cal } = useNAData();
  const [month, setMonth] = useState(currentMonthKey());
  const ms = schedule[month];
  const rows = assistants
    .map((a) => {
      const c = naCountMonth(ms, a.id);
      let worked = 0;
      let rest = 0;
      let off = 0;
      for (let d = 1; d <= daysInMonth(month); d++) {
        const w = naHasAnyShift(ms?.[d], a.id);
        if (w) worked++;
        if (cal.isOffDay(dateStrOf(month, d))) {
          off++;
          if (!w) rest++;
        }
      }
      return { a, c, worked, rest, off };
    })
    .sort((x, y) => y.c.total - x.c.total);

  return (
    <div>
      <PageHeader title="สถิติ NA" />
      <Card>
        <CardBody className="space-y-4">
          <MonthSwitcher value={month} onChange={setMonth} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ a, c, worked, rest, off }) => (
              <div key={a.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{a.name}</div>
                    <div className="text-xs text-ink-mute">{a.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-brand-700">{c.total}</div>
                    <div className="text-xs text-ink-mute">กะ</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                  {[
                    ["เช้า", c.morning + c.morning_workday],
                    ["บ่าย", c.afternoon],
                    ["ดึก", c.night],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-canvas py-1.5">
                      <div className="font-bold">{v}</div>
                      <div className="text-ink-soft">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-ink-soft">
                  เข้าเวร {worked} วัน · หยุดพักวันหยุด {rest}/{off}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
