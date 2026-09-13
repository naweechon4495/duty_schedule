#!/usr/bin/env node
// ย้ายข้อมูลจาก Google Sheet (snapshot JSON) → ไฟล์ SQL สำหรับ D1
//
// ขั้นตอน:
//   1) ดึง snapshot:  curl -s https://<เว็บเดิม>/api/data -o scripts/data/nurse.json
//                     curl -s https://<เว็บเดิม>/api/na   -o scripts/data/na.json
//   2) สร้าง SQL:     node scripts/migrate-from-sheet.mjs
//   3) นำเข้า D1:     npx wrangler d1 execute nawee-db --remote --file scripts/data/seed.sql
//                     (ทดสอบในเครื่อง: --local แทน --remote, preview: --env preview)
//
// รหัสผ่านทุกคน hash ด้วย PBKDF2-SHA256 (ค่าเดียวกับ lib/server/auth.ts) — รหัสเดิมยังใช้ login ได้
// ⚠️ scripts/data/ อยู่ใน .gitignore เพราะมีรหัสผ่านและเบอร์โทร ห้าม commit

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ITERATIONS = 100_000; // ต้องตรงกับ PBKDF2_ITERATIONS ใน lib/server/auth.ts
const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"));

const nurseData = read("nurse.json");
const naData = existsSync(join(dataDir, "na.json")) ? read("na.json") : {};
if (nurseData.error || naData.error) throw new Error("snapshot มี error: " + (nurseData.error || naData.error));

const q = (v) => (v === null || v === undefined ? "''" : "'" + String(v).replace(/'/g, "''") + "'");
const j = (v) => q(JSON.stringify(Array.isArray(v) ? v : []));
const hash = (pw) => {
  const salt = randomBytes(16);
  const h = pbkdf2Sync(String(pw), salt, ITERATIONS, 32, "sha256");
  return `pbkdf2$${ITERATIONS}$${salt.toString("base64")}$${h.toString("base64")}`;
};

const out = [];
const counts = {};
const add = (table, sql) => {
  out.push(sql);
  counts[table] = (counts[table] || 0) + 1;
};

// ล้างข้อมูลเดิมก่อน (รันซ้ำได้) — ไม่ลบ audit_log เพื่อเก็บประวัติ
for (const t of ["nurses", "schedule_slots", "swaps", "leaves", "holidays", "users", "assistants", "na_schedule_slots", "na_swaps", "na_leaves", "na_users", "sessions"]) {
  out.push(`DELETE FROM ${t};`);
}

// ---------- พยาบาล ----------
const seenCodes = new Set();
for (const n of nurseData.nurses || []) {
  if (!n.id || !n.code || seenCodes.has(n.code)) {
    console.warn("ข้ามพยาบาลที่ข้อมูลไม่ครบ/รหัสซ้ำ:", n.id, n.code);
    continue;
  }
  seenCodes.add(n.code);
  add(
    "nurses",
    `INSERT INTO nurses (id, code, name, generation, phone, unavailable_dates, unavailable_weekdays, unavailable_shifts, unavailable_weeks, unavailable_months, unavailable_shifts_in_weeks, unavailable_shifts_in_months, unavailable_holidays, fixed_shifts) VALUES (${[
      q(n.id), q(n.code), q(n.name), q(n.generation || "1"), q(n.phone),
      j(n.unavailableDates), j(n.unavailableWeekdays), j(n.unavailableShifts), j(n.unavailableWeeks), j(n.unavailableMonths),
      j(n.unavailableShiftsInWeeks), j(n.unavailableShiftsInMonths), j(n.unavailableHolidays), j(n.fixedShifts),
    ].join(", ")});`,
  );
}

// ---------- ตารางเวร ----------
function scheduleRows(table, idCol, schedule) {
  for (const [month, ms] of Object.entries(schedule || {})) {
    for (const [day, ds] of Object.entries(ms)) {
      let any = false;
      for (const [shift, ids] of Object.entries(ds)) {
        const seen = new Set();
        (ids || []).forEach((id) => {
          if (!id || seen.has(id)) return;
          seen.add(id);
          any = true;
          add(table, `INSERT INTO ${table} (month, day, shift, position, ${idCol}) VALUES (${q(month)}, ${Number(day)}, ${q(shift)}, ${seen.size - 1}, ${q(id)});`);
        });
      }
      if (!any) add(table, `INSERT INTO ${table} (month, day, shift, position, ${idCol}) VALUES (${q(month)}, ${Number(day)}, '_day', 0, '');`);
    }
  }
}
scheduleRows("schedule_slots", "nurse_id", nurseData.schedule);

// ---------- แลกเวร / ลา / วันหยุด ----------
function swapRows(table, list) {
  for (const s of list || []) {
    add(
      table,
      `INSERT INTO ${table} (id, type, from_id, to_id, date, date2, shift, shift2, reason, status, requested_by, approved_by, created_at, approved_at) VALUES (${[
        q(s.id), q(s.type || "swap"), q(s.from), q(s.to), q(s.date), q(s.date2 || s.date), q(s.shift), q(s.shift2), q(s.reason),
        q(s.status || "pending"), q(s.requestedBy), q(s.approvedBy), q(s.createdAt || new Date().toISOString()), q(s.approvedAt),
      ].join(", ")});`,
    );
  }
}
swapRows("swaps", nurseData.swaps);

for (const l of nurseData.leaves || []) {
  add(
    "leaves",
    `INSERT INTO leaves (id, nurse_id, type, date_from, date_to, reason, status, requested_by, approved_by, created_at) VALUES (${[
      q(l.id), q(l.nurseId), q(l.type), q(l.dateFrom), q(l.dateTo || l.dateFrom), q(l.reason), q(l.status || "pending"),
      q(l.requestedBy), q(l.approvedBy), q(l.createdAt || new Date().toISOString()),
    ].join(", ")});`,
  );
}

const holidaySeen = new Set();
for (const h of nurseData.customHolidays || []) {
  if (!h.date || holidaySeen.has(h.date)) continue;
  holidaySeen.add(h.date);
  add("holidays", `INSERT INTO holidays (date, name) VALUES (${q(h.date)}, ${q(h.name)});`);
}

// ---------- ผู้ใช้ระบบพยาบาล ----------
const userSeen = new Set();
for (const u of nurseData.users || []) {
  if (!u.username || userSeen.has(u.username)) continue;
  userSeen.add(u.username);
  add(
    "users",
    `INSERT INTO users (username, password_hash, fullname, role, nurse_code) VALUES (${[
      q(u.username), q(hash(u.password || randomBytes(12).toString("base64"))), q(u.fullname || u.username),
      q(["admin", "approver", "requester"].includes(u.role) ? u.role : "requester"), q(u.nurseCode),
    ].join(", ")});`,
  );
}

// ---------- ระบบ NA ----------
for (const a of naData.assistants || []) {
  add(
    "assistants",
    `INSERT INTO assistants (id, code, name, phone, unavailable_dates, unavailable_weekdays, unavailable_shifts) VALUES (${[
      q(a.id), q(a.code), q(a.name), q(a.phone), j(a.unavailableDates), j(a.unavailableWeekdays), j(a.unavailableShifts),
    ].join(", ")});`,
  );
}
scheduleRows("na_schedule_slots", "assistant_id", naData.naSchedule);
swapRows("na_swaps", naData.naSwaps);
for (const l of naData.naLeaves || []) {
  add(
    "na_leaves",
    `INSERT INTO na_leaves (id, assistant_id, type, date_from, date_to, reason, status, requested_by, approved_by, created_at) VALUES (${[
      q(l.id), q(l.assistantId), q(l.type), q(l.dateFrom), q(l.dateTo || l.dateFrom), q(l.reason), q(l.status || "pending"),
      q(l.requestedBy), q(l.approvedBy), q(l.createdAt || new Date().toISOString()),
    ].join(", ")});`,
  );
}
let naAdminPassword = null;
const naUsers = (naData.naUsers || []).filter((u) => u.username);
if (!naUsers.length) {
  // ชีตไม่มีบัญชี NA → สร้าง naadmin พร้อมรหัสสุ่ม (ไม่ใช้รหัสเริ่มต้นที่คนอื่นเดาได้)
  naAdminPassword = randomBytes(9).toString("base64").replace(/[+/=]/g, "x");
  naUsers.push({ username: "naadmin", password: naAdminPassword, fullname: "ผู้ดูแลระบบ NA", role: "naadmin" });
}
for (const u of naUsers) {
  add(
    "na_users",
    `INSERT INTO na_users (username, password_hash, fullname, role, assistant_code) VALUES (${[
      q(u.username), q(hash(u.password || randomBytes(12).toString("base64"))), q(u.fullname || u.username),
      q(u.role === "naadmin" ? "naadmin" : "assistant"), q(u.assistantCode),
    ].join(", ")});`,
  );
}

out.push(
  `INSERT INTO audit_log (app, actor, actor_name, action, entity, summary) VALUES ('nurse', 'system', 'ระบบ', 'import', 'data', ${q(
    `ย้ายข้อมูลจาก Google Sheet เข้า D1: พยาบาล ${counts.nurses || 0} คน, ผู้ใช้ ${counts.users || 0} บัญชี, ตารางเวร ${Object.keys(nurseData.schedule || {}).length} เดือน, แลกเวร ${counts.swaps || 0}, วันลา ${counts.leaves || 0}, วันหยุดพิเศษ ${counts.holidays || 0}`,
  )});`,
);

writeFileSync(join(dataDir, "seed.sql"), out.join("\n") + "\n");
console.log("สร้าง scripts/data/seed.sql แล้ว");
console.table(counts);
if (naAdminPassword) console.log(`\n⚠️ ไม่มีบัญชี NA ในชีต — สร้าง naadmin รหัสผ่าน: ${naAdminPassword}\n   (จดไว้ แล้วเปลี่ยนรหัสหลังเข้าสู่ระบบ)`);
