"use client";

import { useState } from "react";
import { Agenda } from "@/components/calendar/agenda";
import { MonthGrid } from "@/components/calendar/month-grid";
import { useNAData } from "@/components/data/na-data";
import { NAAllCell, NADayDetail } from "@/components/na/na-cells";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { currentMonthKey, monthTitleTH } from "@/lib/domain/dates";

export default function NACalendarPage() {
  const { schedule, byId, cal, leaves } = useNAData();
  const [month, setMonth] = useState(currentMonthKey());
  const [detail, setDetail] = useState<string | null>(null);
  const ms = schedule[month];
  return (
    <div>
      <PageHeader title="ปฏิทินเวร NA" description={monthTitleTH(month) + (ms ? ` · จัดแล้ว ${Object.keys(ms).length} วัน` : " · ยังไม่ได้จัดเวร")} />
      <Card>
        <CardBody className="space-y-4">
          <MonthSwitcher value={month} onChange={setMonth} />
          <div className="hidden md:block">
            <MonthGrid month={month} cal={cal} onSelect={setDetail} renderCell={(d) => <NAAllCell ds={ms?.[Number(d.slice(8))]} byId={byId} />} />
          </div>
          <div className="md:hidden">
            <Agenda month={month} cal={cal} onSelect={setDetail} renderDay={(d) => <NAAllCell ds={ms?.[Number(d.slice(8))]} byId={byId} mode="names" />} />
          </div>
        </CardBody>
      </Card>
      {detail && <NADayDetail date={detail} ds={schedule[detail.slice(0, 7)]?.[Number(detail.slice(8))]} byId={byId} cal={cal} leaves={leaves} onClose={() => setDetail(null)} />}
    </div>
  );
}
