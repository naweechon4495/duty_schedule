-- ระบบจัดเวร โรงพยาบาลลำพูน — schema เริ่มต้น (ย้ายจาก Google Sheet)
-- คง id เดิมทุกตัว (N1, S…, L…, A…) เพื่อให้ย้ายข้อมูลได้ตรง
-- ฟิลด์ที่เป็นรายการ (วันไม่สะดวก ฯลฯ) เก็บเป็น JSON TEXT เหมือนโครงสร้างเดิม

-- ===================== ระบบพยาบาล =====================

CREATE TABLE nurses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  generation TEXT NOT NULL,              -- '1' | '2' | '3' | '4' | 'staff'
  phone TEXT NOT NULL DEFAULT '',
  unavailable_dates TEXT NOT NULL DEFAULT '[]',
  unavailable_weekdays TEXT NOT NULL DEFAULT '[]',
  unavailable_shifts TEXT NOT NULL DEFAULT '[]',
  unavailable_weeks TEXT NOT NULL DEFAULT '[]',
  unavailable_months TEXT NOT NULL DEFAULT '[]',
  unavailable_shifts_in_weeks TEXT NOT NULL DEFAULT '[]',
  unavailable_shifts_in_months TEXT NOT NULL DEFAULT '[]',
  unavailable_holidays TEXT NOT NULL DEFAULT '[]',
  fixed_shifts TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- หนึ่งแถว = หนึ่งคนในหนึ่งกะของหนึ่งวัน
-- shift: morning | afternoon | night | night_oncall | preop | preop_morning | preop_afternoon | 'slot|ชื่อเวรกำหนดเอง'
-- position: ลำดับในกะ (morning/afternoon: 0-2 = ทีม 1, 3-5 = ทีม 2)
CREATE TABLE schedule_slots (
  month TEXT NOT NULL,                   -- 'YYYY-MM'
  day INTEGER NOT NULL,
  shift TEXT NOT NULL,
  position INTEGER NOT NULL,
  nurse_id TEXT NOT NULL,
  PRIMARY KEY (month, day, shift, nurse_id)
);
CREATE INDEX idx_schedule_nurse ON schedule_slots (nurse_id, month);

CREATE TABLE swaps (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'swap',     -- swap | giveaway | substitute
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  date TEXT NOT NULL,
  date2 TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL,
  shift2 TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  requested_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_swaps_status ON swaps (status, created_at);

CREATE TABLE leaves (
  id TEXT PRIMARY KEY,
  nurse_id TEXT NOT NULL,
  type TEXT NOT NULL,                    -- vacation | sick | personal | ...
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_leaves_nurse ON leaves (nurse_id, date_from);

CREATE TABLE holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  fullname TEXT NOT NULL,
  role TEXT NOT NULL,                    -- admin | approver | requester
  nurse_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ===================== ระบบผู้ช่วยพยาบาล (NA) =====================

CREATE TABLE assistants (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  unavailable_dates TEXT NOT NULL DEFAULT '[]',
  unavailable_weekdays TEXT NOT NULL DEFAULT '[]',
  unavailable_shifts TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- shift: morning | afternoon | night | morning_workday
CREATE TABLE na_schedule_slots (
  month TEXT NOT NULL,
  day INTEGER NOT NULL,
  shift TEXT NOT NULL,
  position INTEGER NOT NULL,
  assistant_id TEXT NOT NULL,
  PRIMARY KEY (month, day, shift, assistant_id)
);
CREATE INDEX idx_na_schedule_assistant ON na_schedule_slots (assistant_id, month);

CREATE TABLE na_swaps (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'swap',
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  date TEXT NOT NULL,
  date2 TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL,
  shift2 TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE na_leaves (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE na_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  fullname TEXT NOT NULL,
  role TEXT NOT NULL,                    -- naadmin | assistant
  assistant_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ===================== ร่วมกัน =====================

-- token เก็บเป็น SHA-256 hash (ถ้าฐานข้อมูลรั่ว ก็เอา token ไปใช้ login ไม่ได้)
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  app TEXT NOT NULL,                     -- nurse | na
  username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (app, username);

-- บันทึกการใช้งาน: ใครทำอะไร แก้อะไร เมื่อไหร่ (แสดงในหน้า Log)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  app TEXT NOT NULL,                     -- nurse | na
  actor TEXT NOT NULL,                   -- username ('' = ไม่ทราบ เช่น login ผิด)
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,                  -- create | update | delete | approve | reject | login | login_failed | logout | auto_schedule | clear | import | export | reset_password
  entity TEXT NOT NULL,                  -- nurse | schedule | swap | leave | holiday | user | assistant | session | data
  entity_id TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_audit_app_at ON audit_log (app, at DESC);
CREATE INDEX idx_audit_actor ON audit_log (app, actor, at DESC);
CREATE INDEX idx_audit_entity ON audit_log (app, entity, entity_id, at DESC);
