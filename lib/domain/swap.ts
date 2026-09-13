import type { MonthSchedule, Swap } from "../types";
import { replaceInShift } from "./schedule";

export const SWAP_TYPE_LABELS: Record<string, string> = { swap: "แลกเวร", giveaway: "ยกเวร", substitute: "แทนเวร" };
export const STATUS_LABELS: Record<string, string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };

/** เดือนที่การอนุมัติคำขอนี้จะแก้ตาราง */
export function swapMonths(s: Pick<Swap, "type" | "date" | "date2">): string[] {
  const set = new Set([s.date.slice(0, 7)]);
  if (s.type === "swap" && s.date2 && s.date2 !== s.date) set.add(s.date2.slice(0, 7));
  return [...set];
}

/**
 * เปลี่ยนตารางตามคำขอที่อนุมัติ (port จาก updateSwapStatus) — แก้ months ที่ส่งเข้ามาโดยตรง
 * - ทุกประเภท: วันที่ date กะ shift ย้าย from → to
 * - แลกเวร (swap) ที่คนละวัน: วันที่ date2 กะ shift2 ย้าย to → from
 */
export function applySwap(months: Record<string, MonthSchedule>, s: Swap): { first: boolean; second: boolean | null } {
  const day = (dateStr: string) => months[dateStr.slice(0, 7)]?.[parseInt(dateStr.slice(8, 10), 10)];
  const d1 = day(s.date);
  const first = d1 ? replaceInShift(d1, s.shift, s.from, s.to) : false;
  let second: boolean | null = null;
  if (s.type === "swap" && s.date2 && s.date2 !== s.date) {
    const d2 = day(s.date2);
    second = d2 ? replaceInShift(d2, s.shift2 || s.shift, s.to, s.from) : false;
  }
  return { first, second };
}
