import type { Leave, LeaveType, NALeave, RequestStatus, Swap, SwapType } from "../../types";
import { db } from "../db";

// ===================== แลกเวร (ใช้ร่วมกันทั้งพยาบาลและ NA — ต่างกันแค่ชื่อตาราง) =====================

export type SwapTable = "swaps" | "na_swaps";

interface SwapRow {
  id: string;
  type: string;
  from_id: string;
  to_id: string;
  date: string;
  date2: string;
  shift: string;
  shift2: string;
  reason: string;
  status: string;
  requested_by: string;
  approved_by: string;
  created_at: string;
  approved_at: string;
}

const rowToSwap = (r: SwapRow): Swap => ({
  id: r.id,
  type: r.type as SwapType,
  from: r.from_id,
  to: r.to_id,
  date: r.date,
  date2: r.date2,
  shift: r.shift,
  shift2: r.shift2,
  reason: r.reason,
  status: r.status as RequestStatus,
  requestedBy: r.requested_by,
  approvedBy: r.approved_by,
  createdAt: r.created_at,
  approvedAt: r.approved_at,
});

export async function listSwaps(table: SwapTable = "swaps"): Promise<Swap[]> {
  const { results } = await db().prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`).all<SwapRow>();
  return results.map(rowToSwap);
}

export async function getSwap(id: string, table: SwapTable = "swaps"): Promise<Swap | null> {
  const r = await db().prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<SwapRow>();
  return r ? rowToSwap(r) : null;
}

export function insertSwapStmt(s: Swap, table: SwapTable = "swaps"): D1PreparedStatement {
  return db()
    .prepare(
      `INSERT INTO ${table} (id, type, from_id, to_id, date, date2, shift, shift2, reason, status, requested_by, approved_by, created_at, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(s.id, s.type, s.from, s.to, s.date, s.date2, s.shift, s.shift2, s.reason, s.status, s.requestedBy, s.approvedBy, s.createdAt, s.approvedAt);
}

export function setSwapStatusStmt(id: string, status: RequestStatus, approvedBy: string, approvedAt: string, table: SwapTable = "swaps") {
  return db()
    .prepare(`UPDATE ${table} SET status = ?, approved_by = ?, approved_at = ? WHERE id = ? AND status = 'pending'`)
    .bind(status, approvedBy, approvedAt, id);
}

export function deleteSwapStmt(id: string, table: SwapTable = "swaps") {
  return db().prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id);
}

// ===================== วันลา =====================

interface LeaveRow {
  id: string;
  nurse_id?: string;
  assistant_id?: string;
  type: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: string;
  requested_by: string;
  approved_by: string;
  created_at: string;
}

const base = (r: LeaveRow) => ({
  id: r.id,
  type: r.type as LeaveType,
  dateFrom: r.date_from,
  dateTo: r.date_to,
  reason: r.reason,
  status: r.status as RequestStatus,
  requestedBy: r.requested_by,
  approvedBy: r.approved_by,
  createdAt: r.created_at,
});

export async function listLeaves(): Promise<Leave[]> {
  const { results } = await db().prepare("SELECT * FROM leaves ORDER BY created_at DESC").all<LeaveRow>();
  return results.map((r) => ({ ...base(r), nurseId: r.nurse_id! }));
}

export async function getLeave(id: string): Promise<Leave | null> {
  const r = await db().prepare("SELECT * FROM leaves WHERE id = ?").bind(id).first<LeaveRow>();
  return r ? { ...base(r), nurseId: r.nurse_id! } : null;
}

export function insertLeaveStmt(l: Leave) {
  return db()
    .prepare(
      `INSERT INTO leaves (id, nurse_id, type, date_from, date_to, reason, status, requested_by, approved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(l.id, l.nurseId, l.type, l.dateFrom, l.dateTo, l.reason, l.status, l.requestedBy, l.approvedBy, l.createdAt);
}

export function setLeaveStatusStmt(id: string, status: RequestStatus, approvedBy: string, table: "leaves" | "na_leaves" = "leaves") {
  return db()
    .prepare(`UPDATE ${table} SET status = ?, approved_by = ? WHERE id = ? AND status = 'pending'`)
    .bind(status, approvedBy, id);
}

export function deleteLeaveStmt(id: string, table: "leaves" | "na_leaves" = "leaves") {
  return db().prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id);
}

export async function listNALeaves(): Promise<NALeave[]> {
  const { results } = await db().prepare("SELECT * FROM na_leaves ORDER BY created_at DESC").all<LeaveRow>();
  return results.map((r) => ({ ...base(r), assistantId: r.assistant_id! }));
}

export async function getNALeave(id: string): Promise<NALeave | null> {
  const r = await db().prepare("SELECT * FROM na_leaves WHERE id = ?").bind(id).first<LeaveRow>();
  return r ? { ...base(r), assistantId: r.assistant_id! } : null;
}

export function insertNALeaveStmt(l: NALeave) {
  return db()
    .prepare(
      `INSERT INTO na_leaves (id, assistant_id, type, date_from, date_to, reason, status, requested_by, approved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(l.id, l.assistantId, l.type, l.dateFrom, l.dateTo, l.reason, l.status, l.requestedBy, l.approvedBy, l.createdAt);
}
