# ระบบจัดเวรพยาบาล โรงพยาบาลลำพูน

Lamphun Hospital Nurse Scheduling System — เว็บแอปจัดตารางเวรพยาบาลอัตโนมัติ
โฮสต์บน Cloudflare Workers และใช้ Google Sheets เป็นฐานข้อมูล

## โครงสร้างโปรเจกต์

| ไฟล์ | หน้าที่ |
|------|---------|
| `public/index.html` | ตัวเว็บแอปทั้งหมด (HTML/CSS/JS ไฟล์เดียว) — จัดการพยาบาล จัดเวร ปฏิทิน แลกเวร สถิติ |
| `src/worker.js` | Cloudflare Worker — เป็นตัวกลางคุยกับ Google Sheet (`/api/data`) และ LINE Login (`/auth/*`) โดยเก็บ token ไว้ฝั่งเซิร์ฟเวอร์ |
| `apps_script_backend.gs` | โค้ด Google Apps Script — วางในชีต แล้ว Deploy เป็น Web App เพื่อทำหน้าที่เป็น REST API อ่าน/เขียนแต่ละแท็บ |
| `wrangler.toml.example` | ต้นแบบคอนฟิก Cloudflare (คัดลอกเป็น `wrangler.toml` แล้วเติมค่าจริง) |

## ฟีเจอร์หลัก
- จัดการข้อมูลพยาบาล 4 รุ่น + เงื่อนไขวัน/กะที่ไม่สะดวก 8 รูปแบบ
- จัดเวรอัตโนมัติตามกฎ (ทีมไม่ซ้ำรุ่น, รุ่น 4 = Pre-op)
- ปฏิทินรายเดือน + Export PDF/CSV/Excel
- ระบบแลกเวรพร้อมการอนุมัติ, สถิติรายบุคคล
- ล็อกอิน username/password และ (ตัวเลือก) LINE Login
- 3 บทบาท: admin / approver / requester

## การติดตั้ง

### 1. Google Apps Script (ฐานข้อมูล)
1. เปิด Google Sheet → Extensions → Apps Script → วางโค้ดจาก `apps_script_backend.gs`
2. ตั้งค่า `SECRET_TOKEN` เป็นรหัสลับของคุณเอง
3. Deploy → Web app (Execute as: Me, Who has access: Anyone) → คัดลอก URL

### 2. Cloudflare Worker (โฮสต์ + ตัวกลาง)
```bash
cp wrangler.toml.example wrangler.toml   # แล้วเติม account_id + APPS_SCRIPT_URL
npx wrangler secret put APPS_SCRIPT_TOKEN # ใส่ค่าเดียวกับ SECRET_TOKEN ข้างบน
npx wrangler secret put SESSION_SECRET    # สตริงสุ่มยาวๆ
npx wrangler deploy
```

### 3. (ตัวเลือก) LINE Login
สร้าง LINE Login channel → เติม `LINE_CHANNEL_ID` ใน `wrangler.toml` →
`npx wrangler secret put LINE_CHANNEL_SECRET` → ลงทะเบียน callback `https://<your-worker>/auth/line/callback`

## ⚠️ ความปลอดภัย
- ห้าม commit `SECRET_TOKEN`, `wrangler.toml` (มี URL จริง), หรือค่า secret ใดๆ ขึ้น repo
- รหัสผ่านผู้ใช้ระบบเก็บแบบ plaintext ในชีต — เหมาะกับใช้งานภายในองค์กรเท่านั้น
