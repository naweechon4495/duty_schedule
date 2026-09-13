import type { NARole, Role } from "../types";

export const ROLE_LABELS: Record<Role, string> = { admin: "ผู้ดูแลระบบ", approver: "ผู้อนุมัติ", requester: "ผู้ยื่นคำขอ" };
export const NA_ROLE_LABELS: Record<NARole, string> = { naadmin: "ผู้ดูแลระบบ NA", assistant: "ผู้ช่วยพยาบาล" };

/** เมนูที่แต่ละบทบาทเห็น (ตรงกับระบบเดิม) */
export function canSee(role: Role, page: string): boolean {
  switch (page) {
    case "nurses":
    case "holidays":
    case "users":
    case "logs":
    case "settings":
      return role === "admin";
    case "schedule":
      return role === "admin" || role === "approver";
    default:
      return true;
  }
}
