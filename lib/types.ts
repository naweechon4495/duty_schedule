// ชนิดข้อมูลกลาง ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์ (API) และหน้าเว็บ
// รูปแบบตั้งใจให้ตรงกับข้อมูลเดิมในระบบ Google Sheet เพื่อ port logic ได้ตรง

export type Generation = "1" | "2" | "3" | "4" | "staff";

export type StdShift = "morning" | "afternoon" | "night" | "preop" | "preop_morning" | "preop_afternoon";
export type ShiftType = StdShift; // กะที่ใช้ในข้อจำกัด/ fix เวร

export interface DateShift {
  date: string;
  shift: string;
}
export interface WeekRef {
  year: number;
  week: number;
  refDate?: string;
}
export interface WeekShift extends WeekRef {
  shift: string;
}
export interface MonthShift {
  month: string;
  shift: string;
}

export interface Nurse {
  id: string;
  code: string;
  name: string;
  generation: Generation;
  phone: string;
  unavailableDates: string[];
  unavailableWeekdays: number[];
  unavailableShifts: DateShift[];
  unavailableWeeks: WeekRef[];
  unavailableMonths: string[];
  unavailableShiftsInWeeks: WeekShift[];
  unavailableShiftsInMonths: MonthShift[];
  unavailableHolidays: string[];
  fixedShifts: DateShift[];
}

/** ตารางหนึ่งวัน: key = ชื่อกะ (รวม night_oncall และเวรกำหนดเอง "slot|ชื่อ") → รายชื่อ id ตามลำดับ */
export type DaySchedule = Record<string, string[]>;
/** ตารางหนึ่งเดือน: key = วันที่ (1-31) */
export type MonthSchedule = Record<number, DaySchedule>;
/** ตารางทั้งหมด: key = 'YYYY-MM' */
export type Schedule = Record<string, MonthSchedule>;

export type RequestStatus = "pending" | "approved" | "rejected";
export type SwapType = "swap" | "giveaway" | "substitute";

export interface Swap {
  id: string;
  type: SwapType;
  from: string;
  to: string;
  date: string;
  date2: string;
  shift: string;
  shift2: string;
  reason: string;
  status: RequestStatus;
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
  approvedAt: string;
}

export type LeaveType = "personal" | "sick" | "vacation";

export interface Leave {
  id: string;
  nurseId: string;
  type: LeaveType;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: RequestStatus;
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export type Role = "admin" | "approver" | "requester";

/** ผู้ใช้ที่ส่งให้หน้าเว็บ — ไม่มีรหัสผ่านเด็ดขาด */
export interface PublicUser {
  username: string;
  fullname: string;
  role: Role;
  nurseCode: string;
}

export interface SessionUser extends PublicUser {}

export interface BootstrapData {
  me: SessionUser;
  nurses: Nurse[];
  schedule: Schedule;
  swaps: Swap[];
  leaves: Leave[];
  holidays: Holiday[];
  /** admin เห็นทุกคน; บทบาทอื่นเห็นเฉพาะชื่อ-บทบาทสำหรับแสดงผล "ผู้ขอ" */
  users: PublicUser[];
}

// ===================== NA (ผู้ช่วยพยาบาล) =====================

export interface Assistant {
  id: string;
  code: string;
  name: string;
  phone: string;
  unavailableDates: string[];
  unavailableWeekdays: number[];
  unavailableShifts: DateShift[];
}

export type NARole = "naadmin" | "assistant";

export interface NAPublicUser {
  username: string;
  fullname: string;
  role: NARole;
  assistantCode: string;
}

export interface NALeave {
  id: string;
  assistantId: string;
  type: LeaveType;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: RequestStatus;
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
}

export interface NABootstrapData {
  me: NAPublicUser;
  assistants: Assistant[];
  schedule: Schedule;
  swaps: Swap[];
  leaves: NALeave[];
  holidays: Holiday[];
  users: NAPublicUser[];
}

// ===================== Audit log =====================

export interface AuditEntry {
  id: number;
  at: string;
  app: "nurse" | "na";
  actor: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before: unknown;
  after: unknown;
}
