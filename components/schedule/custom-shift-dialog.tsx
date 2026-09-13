"use client";

import { useMemo, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input } from "@/components/ui/form";
import { PeoplePicker } from "@/components/ui/people-picker";
import { api } from "@/lib/client/api";
import { monthTitleTH } from "@/lib/domain/dates";
import { GENERATIONS, GEN_LABELS, SLOT_LABELS } from "@/lib/domain/schedule";

export function CustomShiftDialog({ month, onClose }: { month: string; onClose: () => void }) {
  const { nurses, mutate } = useNurseData();
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("morning");
  const [scope, setScope] = useState<"month" | "range" | "day">("day");
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [count, setCount] = useState(1);
  const [pick, setPick] = useState<"random" | "manual">("manual");
  const [gens, setGens] = useState<string[]>([...GENERATIONS]);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      nurses
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
        .map((n) => ({ id: n.id, label: `${n.code} ${n.name}`, hint: GEN_LABELS[n.generation] })),
    [nurses],
  );

  const valid = name.trim() && (scope === "month" || (scope === "day" ? day : from && to)) && (pick === "random" ? gens.length > 0 : manualIds.length > 0);

  const submit = async () => {
    setSaving(true);
    const ok = await mutate(
      () => api("/api/schedule/custom", { body: { name, slot, scope, month, day, from, to, count, pick, gens, manualIds, excludeIds } }),
      `เพิ่มเวร "${name}" แล้ว`,
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="เพิ่มเวรกำหนดเอง"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            เพิ่มเวร
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ชื่อเวร *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ประชุมวิชาการ, อบรม CPR" maxLength={100} />
        </Field>
        <Field label="กะเวลา">
          <div className="flex flex-wrap gap-2">
            {Object.entries(SLOT_LABELS).map(([k, l]) => (
              <ChoiceChip key={k} type="radio" name="cs-slot" checked={slot === k} onChange={() => setSlot(k)}>
                {l}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        <Field label="ขอบเขตวัน">
          <div className="flex flex-wrap gap-2">
            <ChoiceChip type="radio" name="cs-scope" checked={scope === "day"} onChange={() => setScope("day")}>
              วันเดียว
            </ChoiceChip>
            <ChoiceChip type="radio" name="cs-scope" checked={scope === "range"} onChange={() => setScope("range")}>
              ช่วงวันที่
            </ChoiceChip>
            <ChoiceChip type="radio" name="cs-scope" checked={scope === "month"} onChange={() => setScope("month")}>
              ทั้งเดือน {monthTitleTH(month)}
            </ChoiceChip>
          </div>
        </Field>
        {scope === "day" && (
          <Field label="วันที่">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        )}
        {scope === "range" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="ตั้งแต่">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="ถึง">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="วิธีเลือกคน">
          <div className="flex flex-wrap gap-2">
            <ChoiceChip type="radio" name="cs-pick" checked={pick === "manual"} onChange={() => setPick("manual")}>
              เลือกเอง
            </ChoiceChip>
            <ChoiceChip type="radio" name="cs-pick" checked={pick === "random"} onChange={() => setPick("random")}>
              สุ่มจากคนที่ยังไม่มีเวร
            </ChoiceChip>
          </div>
        </Field>
        {pick === "manual" ? (
          <Field label={`เลือกพยาบาล (${manualIds.length} คน)`}>
            <PeoplePicker options={options} value={manualIds} onChange={setManualIds} />
          </Field>
        ) : (
          <>
            <Field label="จำนวนคนต่อวัน">
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-28" />
            </Field>
            <Field label="รุ่นที่นำไปสุ่ม">
              <div className="flex flex-wrap gap-2">
                {GENERATIONS.map((g) => (
                  <ChoiceChip key={g} checked={gens.includes(g)} onChange={(on) => setGens(on ? [...gens, g] : gens.filter((x) => x !== g))}>
                    {GEN_LABELS[g]}
                  </ChoiceChip>
                ))}
              </div>
            </Field>
            <Field label={`คนที่ไม่นำไปสุ่ม (${excludeIds.length} คน)`}>
              <PeoplePicker options={options} value={excludeIds} onChange={setExcludeIds} maxHeight="max-h-40" />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}
