"use client";

import { ArrowDownWideNarrow, BarChart3, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { GenBadge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { currentMonthKey, dateStrOf, daysInMonth } from "@/lib/domain/dates";
import { GENERATIONS, GEN_LABELS, STD_SHIFTS } from "@/lib/domain/schedule";

interface Row {
  id: string;
  code: string;
  name: string;
  gen: string;
  total: number;
  morning: number;
  afternoon: number;
  night: number;
  oncall: number;
  preop: number;
  daysWorked: number;
  rest: number;
  workedOff: number;
  offTotal: number;
}

export default function StatsPage() {
  const { nurses, schedule, cal } = useNurseData();
  const [month, setMonth] = useState(currentMonthKey());
  const [gen, setGen] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"total" | "code" | "night">("total");

  const rows = useMemo<Row[]>(() => {
    const ms = schedule[month] || {};
    const map = new Map<string, Row>(
      nurses.map((n) => [
        n.id,
        { id: n.id, code: n.code, name: n.name, gen: n.generation, total: 0, morning: 0, afternoon: 0, night: 0, oncall: 0, preop: 0, daysWorked: 0, rest: 0, workedOff: 0, offTotal: 0 },
      ]),
    );
    for (let d = 1; d <= daysInMonth(month); d++) {
      const ds = ms[d];
      const off = cal.isOffDay(dateStrOf(month, d));
      const worked = new Set<string>();
      if (ds) {
        STD_SHIFTS.forEach((k) =>
          (ds[k] || []).forEach((id) => {
            const r = map.get(id);
            if (!r) return;
            r.total++;
            worked.add(id);
            if (k === "morning") r.morning++;
            else if (k === "afternoon") r.afternoon++;
            else if (k === "night") r.night++;
            else r.preop++;
          }),
        );
        (ds.night_oncall || []).forEach((id) => map.get(id) && map.get(id)!.oncall++);
      }
      map.forEach((r) => {
        const w = worked.has(r.id);
        if (w) r.daysWorked++;
        if (off) {
          r.offTotal++;
          if (w) r.workedOff++;
          else r.rest++;
        }
      });
    }
    const s = q.trim().toLowerCase();
    return [...map.values()]
      .filter((r) => (!gen || r.gen === gen) && (!s || (r.code + r.name).toLowerCase().includes(s)))
      .sort((a, b) =>
        sort === "code" ? a.code.localeCompare(b.code, "th", { numeric: true }) : sort === "night" ? b.night - a.night || b.total - a.total : b.total - a.total || a.code.localeCompare(b.code, "th", { numeric: true }),
      );
  }, [nurses, schedule, month, cal, gen, q, sort]);

  const totalSlots = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <PageHeader title="สถิติการเข้าเวร" description="จำนวนกะต่อคน วันเข้าเวร และวันหยุดพัก" />
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <MonthSwitcher value={month} onChange={setMonth} />
            <div className="grid grid-cols-2 gap-2 sm:flex lg:ml-auto">
              <div className="relative col-span-2 sm:w-56">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัส" className="pl-9" />
              </div>
              <Select value={gen} onChange={(e) => setGen(e.target.value)} aria-label="รุ่น">
                <option value="">ทุกรุ่น</option>
                {GENERATIONS.map((g) => (
                  <option key={g} value={g}>
                    {GEN_LABELS[g]}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="เรียง">
                <option value="total">เรียง: เวรมาก → น้อย</option>
                <option value="night">เรียง: ดึกมาก → น้อย</option>
                <option value="code">เรียง: รหัส</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <ArrowDownWideNarrow className="size-4" /> {rows.length} คน · รวม {totalSlots} กะ-คน
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={<BarChart3 />} title="ไม่มีข้อมูล" />
          ) : (
            <>
              {/* Desktop/Tablet: ตาราง */}
              <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-canvas text-xs text-ink-soft">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">พยาบาล</th>
                      <th className="px-2 py-2.5 font-semibold">รวม</th>
                      <th className="px-2 py-2.5 font-semibold">เช้า</th>
                      <th className="px-2 py-2.5 font-semibold">บ่าย</th>
                      <th className="px-2 py-2.5 font-semibold">ดึก</th>
                      <th className="px-2 py-2.5 font-semibold">Pre-op</th>
                      <th className="px-2 py-2.5 font-semibold">วันเข้าเวร</th>
                      <th className="hidden px-2 py-2.5 font-semibold lg:table-cell">วันหยุดพัก</th>
                      <th className="hidden px-2 py-2.5 font-semibold lg:table-cell">เข้าเวรวันหยุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-canvas/60">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink">{r.name}</span>
                            <GenBadge gen={r.gen} />
                          </div>
                          <div className="text-xs text-ink-mute">{r.code}</div>
                        </td>
                        <td className="px-2 py-2 text-center text-base font-bold text-brand-700">{r.total}</td>
                        <td className="px-2 py-2 text-center">{r.morning}</td>
                        <td className="px-2 py-2 text-center">{r.afternoon}</td>
                        <td className="px-2 py-2 text-center">
                          {r.night}
                          {r.oncall > 0 && <span className="ml-1 text-xs text-amber-700">(On call {r.oncall})</span>}
                        </td>
                        <td className="px-2 py-2 text-center">{r.preop}</td>
                        <td className="px-2 py-2 text-center">{r.daysWorked}</td>
                        <td className="hidden px-2 py-2 text-center lg:table-cell">{r.rest}</td>
                        <td className="hidden px-2 py-2 text-center lg:table-cell">
                          {r.workedOff}/{r.offTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: การ์ด */}
              <div className="space-y-2 md:hidden">
                {rows.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{r.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-ink-mute">
                          {r.code} <GenBadge gen={r.gen} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-brand-700">{r.total}</div>
                        <div className="text-xs text-ink-mute">กะ</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                      {[
                        ["เช้า", r.morning],
                        ["บ่าย", r.afternoon],
                        ["ดึก", r.night],
                        ["Pre-op", r.preop],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-lg bg-canvas py-1.5">
                          <div className="font-bold text-ink">{v}</div>
                          <div className="text-ink-soft">{l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-ink-soft">
                      เข้าเวร {r.daysWorked} วัน · หยุดพัก {r.rest} วัน · เข้าเวรวันหยุด {r.workedOff}/{r.offTotal}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
