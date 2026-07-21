/**
 * ===================================================================
 * Backend ฐานข้อมูลสำหรับ "ระบบจัดเวรพยาบาล โรงพยาบาลลำพูน"
 * เวอร์ชัน 2: แยกเป็นชีตย่อยต่อตาราง (Nurses / Schedule / Swaps / Holidays / Users)
 * ===================================================================
 *
 * นี่คือโค้ดเวอร์ชันใหม่ ใช้แทนโค้ดเดิมที่เก็บทุกอย่างเป็น key/value ในชีตเดียว
 * (ชีตเดิมชื่อ "AppData" จะไม่ถูกใช้งานอีกต่อไป ลบทิ้งได้ภายหลัง)
 *
 * สิ่งที่แก้ไขจากเวอร์ชันแรก:
 * 1. แยกข้อมูลแต่ละประเภทเป็นชีตของตัวเอง อ่าน/แก้ในหน้า Sheets ได้ตรงๆ
 * 2. แก้บั๊กชื่อภาษาไทยเพี้ยน — เวอร์ชันแรกอ่านข้อมูลที่ส่งมาแบบไม่ระบุ encoding
 *    ทำให้ตัวอักษรไทยถูกตีความผิดเป็น Latin-1 เวอร์ชันนี้บังคับอ่านเป็น UTF-8 เสมอ
 * 3. บังคับให้ทุกคอลัมน์เป็นข้อความล้วน (Plain Text) ก่อนเขียน กัน Google Sheets
 *    แปลงค่าที่หน้าตาเหมือนวันที่/ตัวเลข (เช่น "2026-07-15" หรือรุ่น "1") ให้กลายเป็น
 *    วันที่จริง/ตัวเลขจริงโดยไม่ได้ตั้งใจ ซึ่งจะทำให้แอปอ่านค่ากลับไปผิด
 *
 * วิธีติดตั้ง/อัปเดต:
 * 1. เปิด Google Sheet ของคุณ → Extensions → Apps Script
 * 2. ลบโค้ดเดิมทั้งหมดใน Code.gs แล้ววางโค้ดในไฟล์นี้แทนทั้งหมด
 * 3. ตรวจสอบว่า SECRET_TOKEN ด้านล่างตรงกับที่ตั้งไว้เดิม (ไม่ต้องเปลี่ยน ถ้าเคยตั้งไว้แล้ว)
 * 4. Ctrl+S บันทึก
 * 5. Deploy → Manage deployments → ไอคอนดินสอ (แก้ไข deployment เดิม) →
 *    Version: "New version" → Deploy (URL จะไม่เปลี่ยน)
 * 6. ไม่ต้องแก้อะไรที่ฝั่งเว็บ/Cloudflare Worker เลย เพราะยังเรียก URL เดิมเหมือนเดิม
 *
 * หมายเหตุด้านความปลอดภัย: เหมือนเวอร์ชันแรก — Token คือรหัสผ่านของ API ห้ามเผยแพร่
 */

// ⚠️ ตั้งค่าเป็นรหัสลับของคุณเอง (สุ่มยาวๆ) แล้วต้องใส่ค่าเดียวกันนี้ที่ Cloudflare ด้วย
//    ผ่านคำสั่ง: npx wrangler secret put APPS_SCRIPT_TOKEN
//    ห้าม commit ค่าจริงขึ้น public repo เด็ดขาด
var SECRET_TOKEN = 'REPLACE_WITH_YOUR_SECRET_TOKEN';

var SHEETS = {
  nurses: 'Nurses',
  schedule: 'Schedule',
  swaps: 'Swaps',
  customHolidays: 'Holidays',
  users: 'Users',
  leaves: 'Leaves',
  // ===== NA (ผู้ช่วยพยาบาล) — ตารางแยกจากพยาบาล =====
  assistants: 'Assistants',
  naSchedule: 'NASchedule',
  naSwaps: 'NASwaps',
  naLeaves: 'NALeaves'
};

var HEADERS = {
  nurses: ['id','code','name','generation','phone','unavailableDates','unavailableWeekdays','unavailableShifts','unavailableWeeks','unavailableMonths','unavailableShiftsInWeeks','unavailableShiftsInMonths','unavailableHolidays','fixedShifts'],
  schedule: ['month','day','shift','nurseId'],
  swaps: ['id','from','to','date','date2','shift','reason','status','requestedBy','approvedBy','createdAt','type'],
  customHolidays: ['date','name'],
  users: ['username','password','fullname','role','lineUserId','nurseCode','assistantCode'],
  leaves: ['id','nurseId','type','dateFrom','dateTo','reason','status','requestedBy','approvedBy','createdAt'],
  assistants: ['id','code','name','phone','unavailableDates','unavailableWeekdays','unavailableShifts'],
  naSchedule: ['month','day','shift','assistantId'],
  naSwaps: ['id','from','to','date','date2','shift','reason','status','requestedBy','approvedBy','createdAt','type'],
  naLeaves: ['id','assistantId','type','dateFrom','dateTo','reason','status','requestedBy','approvedBy','createdAt']
};

function doGet(e) {
  if (!e.parameter || e.parameter.token !== SECRET_TOKEN) {
    return jsonOutput({ error: 'unauthorized' });
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return jsonOutput({
    nurses: readNurses(getOrCreateSheet(ss, SHEETS.nurses, HEADERS.nurses)),
    schedule: readSchedule(getOrCreateSheet(ss, SHEETS.schedule, HEADERS.schedule)),
    swaps: readSwaps(getOrCreateSheet(ss, SHEETS.swaps, HEADERS.swaps)),
    customHolidays: readHolidays(getOrCreateSheet(ss, SHEETS.customHolidays, HEADERS.customHolidays)),
    users: readUsers(getOrCreateSheet(ss, SHEETS.users, HEADERS.users)),
    leaves: readLeaves(getOrCreateSheet(ss, SHEETS.leaves, HEADERS.leaves)),
    assistants: readAssistants(getOrCreateSheet(ss, SHEETS.assistants, HEADERS.assistants)),
    naSchedule: readSchedule2(getOrCreateSheet(ss, SHEETS.naSchedule, HEADERS.naSchedule)),
    naSwaps: readSwaps(getOrCreateSheet(ss, SHEETS.naSwaps, HEADERS.naSwaps)),
    naLeaves: readNALeaves(getOrCreateSheet(ss, SHEETS.naLeaves, HEADERS.naLeaves))
  });
}

function doPost(e) {
  var body;
  try {
    // สำคัญ: ระบุ 'UTF-8' ตรงๆ กัน Apps Script เดาผิดเป็น Latin-1 (สาเหตุที่ชื่อไทยเพี้ยนก่อนหน้านี้)
    var raw = e.postData.getDataAsString('UTF-8');
    body = JSON.parse(raw);
  } catch (err) {
    return jsonOutput({ error: 'invalid_json' });
  }
  if (body.token !== SECRET_TOKEN) {
    return jsonOutput({ error: 'unauthorized' });
  }
  var data = body.data || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (data.nurses) writeNurses(getOrCreateSheet(ss, SHEETS.nurses, HEADERS.nurses), data.nurses);
  if (data.schedule) writeSchedule(getOrCreateSheet(ss, SHEETS.schedule, HEADERS.schedule), data.schedule);
  if (data.swaps) writeSwaps(getOrCreateSheet(ss, SHEETS.swaps, HEADERS.swaps), data.swaps);
  if (data.customHolidays) writeHolidays(getOrCreateSheet(ss, SHEETS.customHolidays, HEADERS.customHolidays), data.customHolidays);
  if (data.users) writeUsers(getOrCreateSheet(ss, SHEETS.users, HEADERS.users), data.users);
  if (data.leaves) writeLeaves(getOrCreateSheet(ss, SHEETS.leaves, HEADERS.leaves), data.leaves);
  if (data.assistants) writeAssistants(getOrCreateSheet(ss, SHEETS.assistants, HEADERS.assistants), data.assistants);
  if (data.naSchedule) writeSchedule2(getOrCreateSheet(ss, SHEETS.naSchedule, HEADERS.naSchedule), data.naSchedule);
  if (data.naSwaps) writeSwaps(getOrCreateSheet(ss, SHEETS.naSwaps, HEADERS.naSwaps), data.naSwaps);
  if (data.naLeaves) writeNALeaves(getOrCreateSheet(ss, SHEETS.naLeaves, HEADERS.naLeaves), data.naLeaves);
  return jsonOutput({ ok: true, savedAt: new Date().toISOString() });
}

// ---------- sheet helpers ----------

function getOrCreateSheet(ss, name, header) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
  }
  return sheet;
}

// เขียนทับทั้งชีตด้วยชุดแถวใหม่ทั้งหมด (รวมหัวตาราง) และบังคับ format เป็นข้อความล้วน
// ก่อนเขียนเสมอ กัน Google Sheets ตีความค่าเป็นวันที่/ตัวเลขเอง
function overwriteSheet(sheet, rows) {
  sheet.clear();
  if (rows.length === 0) return;
  var numCols = rows[0].length;
  var range = sheet.getRange(1, 1, rows.length, numCols);
  range.setNumberFormat('@');
  range.setValues(rows);
}

function parseJsonSafe(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  try { return JSON.parse(value); } catch (err) { return fallback; }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Nurses ----------

function readNurses(sheet) {
  var rows = sheet.getDataRange().getValues();
  var nurses = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    nurses.push({
      id: String(r[0]), code: String(r[1]), name: String(r[2]), generation: String(r[3]), phone: String(r[4] || ''),
      unavailableDates: parseJsonSafe(r[5], []),
      unavailableWeekdays: parseJsonSafe(r[6], []),
      unavailableShifts: parseJsonSafe(r[7], []),
      unavailableWeeks: parseJsonSafe(r[8], []),
      unavailableMonths: parseJsonSafe(r[9], []),
      unavailableShiftsInWeeks: parseJsonSafe(r[10], []),
      unavailableShiftsInMonths: parseJsonSafe(r[11], []),
      unavailableHolidays: parseJsonSafe(r[12], []),
      fixedShifts: parseJsonSafe(r[13], [])
    });
  }
  return nurses;
}

function writeNurses(sheet, nurses) {
  var rows = [HEADERS.nurses];
  nurses.forEach(function (n) {
    rows.push([
      n.id, n.code, n.name, n.generation, n.phone || '',
      JSON.stringify(n.unavailableDates || []),
      JSON.stringify(n.unavailableWeekdays || []),
      JSON.stringify(n.unavailableShifts || []),
      JSON.stringify(n.unavailableWeeks || []),
      JSON.stringify(n.unavailableMonths || []),
      JSON.stringify(n.unavailableShiftsInWeeks || []),
      JSON.stringify(n.unavailableShiftsInMonths || []),
      JSON.stringify(n.unavailableHolidays || []),
      JSON.stringify(n.fixedShifts || [])
    ]);
  });
  overwriteSheet(sheet, rows);
}

// ---------- Schedule (long format: 1 แถว = 1 การจัดเวร 1 คนต่อกะ) ----------

function readSchedule(sheet) {
  var rows = sheet.getDataRange().getValues();
  var schedule = {};
  for (var i = 1; i < rows.length; i++) {
    var month = rows[i][0], day = rows[i][1], shift = rows[i][2], nurseId = rows[i][3];
    if (!month) continue;
    if (!schedule[month]) schedule[month] = {};
    if (!schedule[month][day]) schedule[month][day] = { morning: [], afternoon: [], night: [], preop: [], preop_morning: [], preop_afternoon: [] };
    if (!schedule[month][day][shift]) schedule[month][day][shift] = [];
    schedule[month][day][shift].push(String(nurseId));
  }
  return schedule;
}

function writeSchedule(sheet, schedule) {
  var rows = [HEADERS.schedule];
  Object.keys(schedule).forEach(function (month) {
    Object.keys(schedule[month]).forEach(function (day) {
      var daySched = schedule[month][day];
      Object.keys(daySched).forEach(function (shift) {
        (daySched[shift] || []).forEach(function (nurseId) {
          rows.push([month, day, shift, nurseId]);
        });
      });
    });
  });
  overwriteSheet(sheet, rows);
}

// ---------- Swaps ----------

function readSwaps(sheet) {
  var rows = sheet.getDataRange().getValues();
  var swaps = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    swaps.push({
      id: String(r[0]), from: String(r[1]), to: String(r[2]), date: String(r[3]), date2: String(r[4]),
      shift: String(r[5]), reason: String(r[6] || ''), status: String(r[7]),
      requestedBy: String(r[8] || ''), approvedBy: String(r[9] || ''), createdAt: String(r[10] || ''),
      type: String(r[11] || 'swap')
    });
  }
  return swaps;
}

function writeSwaps(sheet, swaps) {
  var rows = [HEADERS.swaps];
  swaps.forEach(function (s) {
    rows.push([s.id, s.from, s.to, s.date, s.date2, s.shift, s.reason || '', s.status, s.requestedBy || '', s.approvedBy || '', s.createdAt || '', s.type || 'swap']);
  });
  overwriteSheet(sheet, rows);
}

// ---------- Holidays ----------

function readHolidays(sheet) {
  var rows = sheet.getDataRange().getValues();
  var holidays = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    holidays.push({ date: String(r[0]), name: String(r[1]) });
  }
  return holidays;
}

function writeHolidays(sheet, holidays) {
  var rows = [HEADERS.customHolidays];
  holidays.forEach(function (h) {
    rows.push([h.date, h.name]);
  });
  overwriteSheet(sheet, rows);
}

// ---------- Users ----------

function readUsers(sheet) {
  var rows = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var user = { username: String(r[0]), password: String(r[1]), fullname: String(r[2]), role: String(r[3]) };
    if (r[4]) user.lineUserId = String(r[4]);
    if (r[5]) user.nurseCode = String(r[5]);
    if (r[6]) user.assistantCode = String(r[6]);
    users.push(user);
  }
  return users;
}

function writeUsers(sheet, users) {
  var rows = [HEADERS.users];
  users.forEach(function (u) {
    rows.push([u.username, u.password, u.fullname, u.role, u.lineUserId || '', u.nurseCode || '', u.assistantCode || '']);
  });
  overwriteSheet(sheet, rows);
}

// ---------- Leaves (วันลา) ----------

function readLeaves(sheet) {
  var rows = sheet.getDataRange().getValues();
  var leaves = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    leaves.push({
      id: String(r[0]), nurseId: String(r[1]), type: String(r[2]),
      dateFrom: String(r[3]), dateTo: String(r[4] || r[3]), reason: String(r[5] || ''),
      status: String(r[6] || 'pending'), requestedBy: String(r[7] || ''),
      approvedBy: String(r[8] || ''), createdAt: String(r[9] || '')
    });
  }
  return leaves;
}

function writeLeaves(sheet, leaves) {
  var rows = [HEADERS.leaves];
  leaves.forEach(function (l) {
    rows.push([l.id, l.nurseId, l.type, l.dateFrom, l.dateTo || l.dateFrom, l.reason || '', l.status || 'pending', l.requestedBy || '', l.approvedBy || '', l.createdAt || '']);
  });
  overwriteSheet(sheet, rows);
}

// ==================================================================
// ===== NA (ผู้ช่วยพยาบาล) — read/write ตารางแยกของ NA =====
// ==================================================================

// ---------- Assistants (รายชื่อ NA) ----------
function readAssistants(sheet) {
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    out.push({
      id: String(r[0]), code: String(r[1]), name: String(r[2]), phone: String(r[3] || ''),
      unavailableDates: parseJsonSafe(r[4], []),
      unavailableWeekdays: parseJsonSafe(r[5], []),
      unavailableShifts: parseJsonSafe(r[6], [])
    });
  }
  return out;
}

function writeAssistants(sheet, list) {
  var rows = [HEADERS.assistants];
  list.forEach(function (a) {
    rows.push([
      a.id, a.code, a.name, a.phone || '',
      JSON.stringify(a.unavailableDates || []),
      JSON.stringify(a.unavailableWeekdays || []),
      JSON.stringify(a.unavailableShifts || [])
    ]);
  });
  overwriteSheet(sheet, rows);
}

// ---------- NASchedule (long format: 1 แถว = 1 เวร 1 คน) — คีย์ assistantId ----------
function readSchedule2(sheet) {
  var rows = sheet.getDataRange().getValues();
  var schedule = {};
  for (var i = 1; i < rows.length; i++) {
    var month = rows[i][0], day = rows[i][1], shift = rows[i][2], id = rows[i][3];
    if (!month) continue;
    if (!schedule[month]) schedule[month] = {};
    if (!schedule[month][day]) schedule[month][day] = { morning: [], afternoon: [], night: [], morning_workday: [] };
    if (!schedule[month][day][shift]) schedule[month][day][shift] = [];
    schedule[month][day][shift].push(String(id));
  }
  return schedule;
}

function writeSchedule2(sheet, schedule) {
  var rows = [HEADERS.naSchedule];
  Object.keys(schedule).forEach(function (month) {
    Object.keys(schedule[month]).forEach(function (day) {
      var daySched = schedule[month][day];
      Object.keys(daySched).forEach(function (shift) {
        (daySched[shift] || []).forEach(function (id) {
          rows.push([month, day, shift, id]);
        });
      });
    });
  });
  overwriteSheet(sheet, rows);
}

// ---------- NALeaves (วันลา NA) — คีย์ assistantId ----------
function readNALeaves(sheet) {
  var rows = sheet.getDataRange().getValues();
  var leaves = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    leaves.push({
      id: String(r[0]), assistantId: String(r[1]), type: String(r[2]),
      dateFrom: String(r[3]), dateTo: String(r[4] || r[3]), reason: String(r[5] || ''),
      status: String(r[6] || 'pending'), requestedBy: String(r[7] || ''),
      approvedBy: String(r[8] || ''), createdAt: String(r[9] || '')
    });
  }
  return leaves;
}

function writeNALeaves(sheet, leaves) {
  var rows = [HEADERS.naLeaves];
  leaves.forEach(function (l) {
    rows.push([l.id, l.assistantId, l.type, l.dateFrom, l.dateTo || l.dateFrom, l.reason || '', l.status || 'pending', l.requestedBy || '', l.approvedBy || '', l.createdAt || '']);
  });
  overwriteSheet(sheet, rows);
}
