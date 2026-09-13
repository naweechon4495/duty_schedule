"use client";

import type { Nurse, Schedule, Swap } from "../types";
import { MONTH_TH, WEEKDAY_SHORT_TH, WEEKDAY_TH, dateStrOf, daysInMonth, todayStr, weekdayOf } from "../domain/dates";
import type { HolidayCalendar } from "../domain/holidays";
import { SHIFT_LABELS } from "../domain/schedule";
import { SWAP_TYPE_LABELS } from "../domain/swap";
import { HEADER_FILL, downloadBlob, loadExcelJS, saveWorkbook, thinBorder } from "./download";

const GEN_ORDER: Record<string, number> = { "1": 1, "2": 2, "3": 3, "4": 4, staff: 5 };
const sortNurses = (list: Nurse[]) =>
  list.slice().sort((a, b) => (GEN_ORDER[a.generation] || 9) - (GEN_ORDER[b.generation] || 9) || a.code.localeCompare(b.code, "th", { numeric: true }));

/** รหัสในช่องตารางแบบกริด (เหมือนไฟล์เดิมที่ใช้อยู่) */
function cellCode(ds: Schedule[string][number] | undefined, id: string, workday: boolean): string {
  if (ds) {
    const mi = (ds.morning || []).indexOf(id);
    if (mi >= 0) return mi < 3 ? "ช1" : "ช2";
    const ai = (ds.afternoon || []).indexOf(id);
    if (ai >= 0) return ai < 3 ? "บ1" : "บ2";
    if ((ds.night || []).includes(id)) return (ds.night_oncall || []).includes(id) ? "ด2" : "ด";
    if ((ds.preop_morning || []).includes(id)) return "ชp";
    if ((ds.preop_afternoon || []).includes(id)) return "บp";
    if ((ds.preop || []).includes(id)) return "บpot";
  }
  return workday ? "ช" : "";
}

/** Excel ตารางเวรแบบกริด (แถว = พยาบาล, คอลัมน์ = วันที่) ไฟล์ .xlsx จริง พร้อมสีวันหยุด */
export async function exportScheduleMatrix(month: string, nurses: Nurse[], schedule: Schedule, cal: HolidayCalendar) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ตารางเวร", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
  const [y, m] = month.split("-").map(Number);
  const days = daysInMonth(month);
  const ms = schedule[month] || {};
  const meta = Array.from({ length: days }, (_, i) => {
    const date = dateStrOf(month, i + 1);
    return { d: i + 1, date, w: weekdayOf(date), hol: cal.isHoliday(date), off: cal.isOffDay(date) };
  });

  ws.mergeCells(1, 1, 1, days + 2);
  const title = ws.getCell(1, 1);
  title.value = `ตารางเวรพยาบาล เดือน${MONTH_TH[m - 1]} ${y + 543}`;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: "center" };

  const head = ws.getRow(2);
  const dow = ws.getRow(3);
  head.getCell(1).value = "ลำดับ";
  head.getCell(2).value = "ชื่อ-นามสกุล";
  meta.forEach((x, i) => {
    head.getCell(i + 3).value = x.d;
    dow.getCell(i + 3).value = WEEKDAY_SHORT_TH[x.w];
  });
  [head, dow].forEach((row) =>
    row.eachCell({ includeEmpty: true }, (c, col) => {
      if (col > days + 2) return;
      const x = meta[col - 3];
      c.font = { bold: true, color: { argb: x?.hol ? "FF7C2D12" : "FF1F2937" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: x ? (x.hol ? "FFFFC000" : x.off ? "FFD9D9D9" : "FFF2F2F2") : "FFF2F2F2" } };
      c.border = thinBorder;
    }),
  );

  sortNurses(nurses).forEach((n, i) => {
    const row = ws.getRow(i + 4);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = n.name;
    meta.forEach((x, j) => {
      const c = row.getCell(j + 3);
      c.value = cellCode(ms[x.d], n.id, !x.off);
      c.alignment = { horizontal: "center" };
      if (x.hol) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      else if (x.off) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    });
    row.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= days + 2) c.border = thinBorder;
    });
  });

  const legendRow = nurses.length + 5;
  ws.mergeCells(legendRow, 1, legendRow, days + 2);
  ws.getCell(legendRow, 1).value =
    "คำอธิบาย: ช=เวรเช้าทำการ (จ-ศ), ช1/ช2=เช้าทีม 1/2 (วันหยุด), บ1/บ2=บ่ายทีม 1/2, ด=ดึก, ด2=ดึก On call, ชp=Pre-op เช้า, บp=Pre-op บ่าย, บpot=Pre-op วันธรรมดา | สีส้ม=วันหยุดนักขัตฤกษ์, สีเทา=เสาร์-อาทิตย์";
  ws.getCell(legendRow, 1).font = { size: 10, color: { argb: "FF4B5563" } };

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  for (let i = 3; i <= days + 2; i++) ws.getColumn(i).width = 5;
  await saveWorkbook(wb, `ตารางเวร_${month}.xlsx`);
}

/** CSV รายวัน (เปิดใน Excel ภาษาไทยได้ถูกต้อง) */
export function exportScheduleCsv(month: string, nurses: Nurse[], schedule: Schedule, cal: HolidayCalendar) {
  const name = (id: string) => nurses.find((n) => n.id === id)?.name || "-";
  const list = (ids?: string[]) => '"' + ((ids || []).map(name).join(", ") || "-") + '"';
  let csv = "วันที่,วัน,กะเช้า,กะบ่าย,กะดึก,Pre-op\n";
  const ms = schedule[month] || {};
  for (let d = 1; d <= daysInMonth(month); d++) {
    const date = dateStrOf(month, d);
    const ds = ms[d];
    const pre = ds ? [...(ds.preop_morning || []), ...(ds.preop_afternoon || []), ...(ds.preop || [])] : [];
    csv += [d, WEEKDAY_TH[weekdayOf(date)] + (cal.isHoliday(date) ? " (หยุด)" : ""), list(ds?.morning), list(ds?.afternoon), list(ds?.night), list(pre)].join(",") + "\n";
  }
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `ตารางเวร_${month}.csv`);
}

/** ประวัติการแลก/ยก/แทนเวรที่อนุมัติแล้ว (9 คอลัมน์ตามแบบฟอร์มเดิม) */
export async function exportSwapHistory(swaps: Swap[], nurses: Nurse[]) {
  const rows = swaps.filter((s) => s.status === "approved").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ประวัติการแลกเวร");
  const nm = (id: string) => nurses.find((n) => n.id === id)?.name || id || "-";
  const sh = (k: string) => SHIFT_LABELS[k] || k || "-";
  ws.columns = [
    { header: "ลำดับ", width: 7 },
    { header: "วันเดือนปี", width: 13 },
    { header: "ชื่อ-นามสกุลผู้แลก", width: 28 },
    { header: "วันเดือนปีที่ขอแลก", width: 16 },
    { header: "เวรที่ขอแลก", width: 12 },
    { header: "ชื่อ-นามสกุลผู้รับแลก", width: 28 },
    { header: "เวรที่รับแลก", width: 12 },
    { header: "ประเภท", width: 10 },
    { header: "หมายเหตุ", width: 32 },
  ];
  rows.forEach((s, i) =>
    ws.addRow([i + 1, s.createdAt.slice(0, 10), nm(s.from), s.date, sh(s.shift), nm(s.to), sh(s.shift2 || s.shift), SWAP_TYPE_LABELS[s.type] || s.type, s.reason]),
  );
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { horizontal: "center" };
  });
  ws.eachRow((row) => row.eachCell((c) => (c.border = thinBorder)));
  await saveWorkbook(wb, `ประวัติการแลกเวร_${todayStr()}.xlsx`);
  return rows.length;
}

export async function exportNursesExcel(nurses: Nurse[]) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("พยาบาล");
  ws.columns = [
    { header: "รหัส", width: 12 },
    { header: "ชื่อ-นามสกุล", width: 30 },
    { header: "รุ่น", width: 8 },
    { header: "เบอร์โทร", width: 16 },
  ];
  sortNurses(nurses).forEach((n) => ws.addRow([n.code, n.name, n.generation, n.phone]));
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
  });
  await saveWorkbook(wb, `รายชื่อพยาบาล_${todayStr()}.xlsx`);
}

/** อ่านไฟล์ Excel/CSV รายชื่อ: คอลัมน์ รหัส | ชื่อ | รุ่น | เบอร์โทร (แถวแรกเป็นหัวตาราง) */
export async function readNurseSheet(file: File): Promise<{ code: string; name: string; generation: string; phone: string }[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  return rows
    .slice(1)
    .filter((r) => r && r[0] && r[1])
    .map((r) => ({
      code: String(r[0]).trim(),
      name: String(r[1]).trim(),
      generation: String(r[2] ?? "1").replace(/รุ่น\s*/, "").trim().toLowerCase(),
      phone: String(r[3] ?? "").trim(),
    }));
}
