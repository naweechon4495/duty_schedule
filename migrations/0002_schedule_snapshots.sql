-- สำรองตารางเวรพยาบาลรายเดือน
-- เก็บทั้งเดือนเป็น JSON แถว [day, shift, position, nurse_id] (รูปแบบเดียวกับ schedule_slots) กู้คืนได้ตรงทุกช่อง
CREATE TABLE schedule_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,                   -- 'YYYY-MM'
  kind TEXT NOT NULL,                    -- manual | before_auto | before_clear | before_restore | initial
  note TEXT NOT NULL DEFAULT '',
  days INTEGER NOT NULL DEFAULT 0,
  slots INTEGER NOT NULL DEFAULT 0,      -- จำนวนกะ-คน (ไม่นับ On call)
  rows_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT NOT NULL DEFAULT '',
  created_by_name TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_snapshots_month ON schedule_snapshots (month, id DESC);

-- สำรองตารางทุกเดือนที่มีอยู่ ณ ตอนติดตั้ง (ก่อนเริ่มใช้กฎดึกห้ามติดกัน)
INSERT INTO schedule_snapshots (month, kind, note, days, slots, rows_json, created_by, created_by_name)
SELECT
  month,
  'initial',
  'สำรองอัตโนมัติตอนติดตั้งระบบสำรอง (ก่อนเปลี่ยนเป็นกฎดึกห้ามติดกัน)',
  COUNT(DISTINCT day),
  SUM(CASE WHEN shift IN ('night_oncall', '_day') THEN 0 ELSE 1 END),
  json_group_array(json_array(day, shift, position, nurse_id)),
  'system',
  'ระบบ'
FROM schedule_slots
GROUP BY month;
