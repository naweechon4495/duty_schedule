"use client";

import { ArrowDownUp, FileDown, FileUp, Pencil, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { NurseDialog, constraintCount } from "@/components/nurses/nurse-dialog";
import { RequirePage } from "@/components/shell/nurse-shell";
import { GenBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { GENERATIONS, GEN_LABELS } from "@/lib/domain/schedule";
import { exportNursesExcel, readNurseSheet } from "@/lib/export/schedule";
import type { Nurse } from "@/lib/types";

const GEN_ORDER: Record<string, number> = { "1": 1, "2": 2, "3": 3, "4": 4, staff: 5 };

export default function NursesPage() {
  return (
    <RequirePage page="nurses">
      <NursesInner />
    </RequirePage>
  );
}

function NursesInner() {
  const { nurses, mutate } = useNurseData();
  const [q, setQ] = useState("");
  const [gen, setGen] = useState("");
  const [sort, setSort] = useState<"gen" | "code" | "name">("gen");
  const [editing, setEditing] = useState<Nurse | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byCode = (a: Nurse, b: Nurse) => a.code.localeCompare(b.code, "th", { numeric: true });
    const cmp = {
      gen: (a: Nurse, b: Nurse) => (GEN_ORDER[a.generation] || 9) - (GEN_ORDER[b.generation] || 9) || byCode(a, b),
      code: byCode,
      name: (a: Nurse, b: Nurse) => a.name.localeCompare(b.name, "th") || byCode(a, b),
    }[sort];
    return nurses.filter((n) => (!gen || n.generation === gen) && (!s || (n.code + " " + n.name).toLowerCase().includes(s))).sort(cmp);
  }, [nurses, q, gen, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    nurses.forEach((n) => (c[n.generation] = (c[n.generation] || 0) + 1));
    return c;
  }, [nurses]);

  const toggle = (id: string) =>
    setSelected((p) => {
      const nx = new Set(p);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      return nx;
    });

  const remove = async (n: Nurse) => {
    if (await confirmDialog({ title: `ลบ ${n.name}?`, message: "ข้อมูลพยาบาลคนนี้จะถูกลบ (เวรเดิมในตารางยังอยู่ แต่จะแสดงเป็นไม่พบข้อมูล)", confirmText: "ลบ", tone: "danger" }))
      mutate(() => api(`/api/nurses/${n.id}`, { method: "DELETE" }), "ลบข้อมูลพยาบาลแล้ว");
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await readNurseSheet(file);
      if (!rows.length) return toast.warn("ไม่พบข้อมูลในไฟล์ (คอลัมน์: รหัส | ชื่อ | รุ่น | เบอร์โทร)");
      const ok = await confirmDialog({ title: "นำเข้ารายชื่อ", message: `พบ ${rows.length} แถว — รหัสที่มีอยู่แล้วจะถูกข้าม`, confirmText: "นำเข้า" });
      if (ok) {
        let res: { added: number; skipped: string[] } | undefined;
        await mutate(async () => {
          res = await api("/api/nurses/import", { body: { rows } });
        });
        if (res) toast.success(`นำเข้า ${res.added} คน` + (res.skipped.length ? ` · ข้าม ${res.skipped.length} แถว` : ""));
      }
    } catch (e) {
      toast.error("อ่านไฟล์ไม่สำเร็จ: " + (e instanceof Error ? e.message : e));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <PageHeader
        title="พยาบาล"
        description={`ทั้งหมด ${nurses.length} คน — ` + GENERATIONS.filter((g) => counts[g]).map((g) => `${GEN_LABELS[g]} ${counts[g]}`).join(" · ")}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp /> <span className="hidden sm:inline">นำเข้า</span> Excel
            </Button>
            <Button variant="outline" onClick={() => exportNursesExcel(nurses)}>
              <FileDown /> <span className="hidden sm:inline">ส่งออก</span>
            </Button>
            <Button onClick={() => setEditing(null)}>
              <Plus /> เพิ่มพยาบาล
            </Button>
          </>
        }
      />

      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <div className="relative col-span-2 sm:w-72">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัส" className="pl-9" />
            </div>
            <Select value={gen} onChange={(e) => setGen(e.target.value)} aria-label="รุ่น" className="sm:w-36">
              <option value="">ทุกรุ่น</option>
              {GENERATIONS.map((g) => (
                <option key={g} value={g}>
                  {GEN_LABELS[g]}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="เรียง" className="sm:w-40">
              <option value="gen">เรียงตามรุ่น</option>
              <option value="code">เรียงตามรหัส</option>
              <option value="name">เรียงตามชื่อ</option>
            </Select>
            <span className="col-span-2 text-sm text-ink-soft sm:ml-auto">พบ {list.length} คน</span>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2">
              <span className="text-sm font-semibold text-brand-900">เลือก {selected.size} คน</span>
              <Button size="sm" variant="secondary" className="bg-white" onClick={() => setBulkOpen(true)}>
                <ArrowDownUp /> เปลี่ยนรุ่น
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                ยกเลิกการเลือก
              </Button>
            </div>
          )}

          {list.length === 0 ? (
            <EmptyState icon={<Users />} title="ไม่พบพยาบาล" action={<Button onClick={() => setEditing(null)}>เพิ่มพยาบาล</Button>} />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                <table className="w-full text-sm">
                  <thead className="bg-canvas text-xs text-ink-soft">
                    <tr>
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand-600"
                          aria-label="เลือกทั้งหมด"
                          checked={list.length > 0 && list.every((n) => selected.has(n.id))}
                          onChange={(e) => setSelected(e.target.checked ? new Set(list.map((n) => n.id)) : new Set())}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold">รหัส</th>
                      <th className="px-3 py-2.5 text-left font-semibold">ชื่อ-นามสกุล</th>
                      <th className="px-3 py-2.5 text-left font-semibold">รุ่น</th>
                      <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">เบอร์โทร</th>
                      <th className="px-3 py-2.5 text-left font-semibold">ข้อจำกัด</th>
                      <th className="w-24 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((n) => (
                      <tr key={n.id} className="hover:bg-canvas/60">
                        <td className="px-3 py-2">
                          <input type="checkbox" className="size-4 accent-brand-600" aria-label={`เลือก ${n.name}`} checked={selected.has(n.id)} onChange={() => toggle(n.id)} />
                        </td>
                        <td className="px-3 py-2 font-semibold">{n.code}</td>
                        <td className="px-3 py-2">{n.name}</td>
                        <td className="px-3 py-2">
                          <GenBadge gen={n.generation} />
                        </td>
                        <td className="hidden px-3 py-2 lg:table-cell">{n.phone || "-"}</td>
                        <td className="px-3 py-2 text-xs text-ink-soft">
                          <ConstraintSummary n={n} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="icon-sm" variant="ghost" aria-label={`แก้ไข ${n.name}`} onClick={() => setEditing(n)}>
                              <Pencil />
                            </Button>
                            <Button size="icon-sm" variant="ghost" aria-label={`ลบ ${n.name}`} onClick={() => remove(n)}>
                              <Trash2 className="text-rose-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 md:hidden">
                {list.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 rounded-xl border border-line p-3">
                    <input type="checkbox" className="size-5 accent-brand-600" aria-label={`เลือก ${n.name}`} checked={selected.has(n.id)} onChange={() => toggle(n.id)} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(n)}>
                      <div className="truncate font-semibold text-ink">{n.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                        {n.code} <GenBadge gen={n.generation} />
                        <ConstraintSummary n={n} />
                      </div>
                    </button>
                    {n.phone && (
                      <a href={`tel:${n.phone}`} className="grid size-10 place-items-center rounded-full text-brand-700 hover:bg-brand-50" aria-label={`โทรหา ${n.name}`}>
                        <Phone className="size-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {editing !== undefined && <NurseDialog nurse={editing} onClose={() => setEditing(undefined)} />}
      {bulkOpen && (
        <BulkGenDialog
          ids={[...selected]}
          onClose={(done) => {
            setBulkOpen(false);
            if (done) setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

function ConstraintSummary({ n }: { n: Nurse }) {
  const c = constraintCount(n);
  if (!c && !n.fixedShifts.length) return <span className="text-ink-mute">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {c > 0 && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-rose-800">ไม่สะดวก {c}</span>}
      {n.fixedShifts.length > 0 && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-800">Fix {n.fixedShifts.length}</span>}
    </span>
  );
}

function BulkGenDialog({ ids, onClose }: { ids: string[]; onClose: (done: boolean) => void }) {
  const { mutate } = useNurseData();
  const [gen, setGen] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose(false)}
      title={`เปลี่ยนรุ่น ${ids.length} คน`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onClose(false)}>
            ยกเลิก
          </Button>
          <Button
            disabled={!gen}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await mutate(() => api("/api/nurses/bulk", { body: { ids, generation: gen } }), "เปลี่ยนรุ่นแล้ว");
              setSaving(false);
              if (ok) onClose(true);
            }}
          >
            บันทึก
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {GENERATIONS.map((g) => (
          <ChoiceChip key={g} type="radio" name="bulk-gen" checked={gen === g} onChange={() => setGen(g)}>
            {GEN_LABELS[g]}
          </ChoiceChip>
        ))}
      </div>
    </Dialog>
  );
}
