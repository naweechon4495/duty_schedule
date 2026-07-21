# ระบบจัดเวรพยาบาล โรงพยาบาลลำพูน

Lamphun Hospital Nurse Scheduling System — เว็บแอปจัดตารางเวรพยาบาลอัตโนมัติ
โฮสต์บน Cloudflare Workers และใช้ Google Sheets เป็นฐานข้อมูล

## โครงสร้างโปรเจกต์

| ไฟล์ | หน้าที่ |
|------|---------|
| `public/index.html` | ตัวเว็บแอปทั้งหมด (HTML/CSS/JS ไฟล์เดียว) — จัดการพยาบาล จัดเวร ปฏิทิน แลกเวร สถิติ |
| `src/worker.js` | Cloudflare Worker — เป็นตัวกลางคุยกับ Google Sheet (`/api/data`) และ LINE Login (`/auth/*`) โดยเก็บ token ไว้ฝั่งเซิร์ฟเวอร์ |
| `apps_script_backend.gs` | โค้ด Google Apps Script — วางในชีต แล้ว Deploy เป็น Web App เพื่อทำหน้าที่เป็น REST API อ่าน/เขียนแต่ละแท็บ |
| `wrangler.toml` | คอนฟิก Cloudflare Worker (ไม่มีความลับ — ค่าลับทั้งหมดเป็น Secret) |

## ฟีเจอร์หลัก
- จัดการข้อมูลพยาบาล 4 รุ่น + เงื่อนไขวัน/กะที่ไม่สะดวก 8 รูปแบบ
- จัดเวรอัตโนมัติตามกฎ (ทีมไม่ซ้ำรุ่น, รุ่น 4 = Pre-op, เฉลี่ยแต่ละกะ, ดึก On call, บ่ายวันนี้ไม่ต่อดึกวันถัดไป)
- ปฏิทินรายเดือน + Export PDF/CSV/Excel + หน้าแรก "ตารางเวรของฉัน"
- ระบบแลกเวร/ยกเวรพร้อมการอนุมัติ, สถิติรายบุคคล (รวมสถิติวันหยุด)
- ระบบวันลา (ลากิจ/ลาป่วย/ลาพักร้อน) + แนะนำคนขึ้นแทนเมื่อลาป่วยทับเวร
- เพิ่มเวรกำหนดเอง (ชื่อ/กะ/ช่วงวัน + สุ่มคนว่าง)
- ผูกบัญชีผู้ใช้กับพยาบาล/ผู้ช่วยพยาบาลด้วยรหัส
- ล็อกอิน username/password และ (ตัวเลือก) LINE Login
- 4 บทบาท: admin / approver / requester / **assistant (ผู้ช่วยพยาบาล NA)**
- **โมดูลผู้ช่วยพยาบาล (NA)** — ตารางเวรแยกอิสระจากพยาบาลโดยสิ้นเชิง: จัดเวรอัตโนมัติ (เช้า/บ่าย/ดึก + เช้าทำการ, เฉลี่ยเท่ากัน, เลี่ยงวันลา/วันไม่สะดวก, บ่าย→ไม่ต่อดึก), ปฏิทิน NA, เวรฉัน NA, แลก/ยกเวร NA, วันลา NA, สถิติ NA — ผู้ใช้ role `assistant` เห็นเฉพาะข้อมูล NA ของตัวเอง **มองไม่เห็นข้อมูล/เวรของพยาบาล**

> ⚠️ **หลังอัปเดตนี้ต้อง redeploy Apps Script** (`apps_script_backend.gs`) หนึ่งครั้ง เพราะเพิ่มตาราง `Assistants` / `NASchedule` / `NASwaps` / `NALeaves` และคอลัมน์ `assistantCode` (Users) — ก่อน redeploy แอปยังใช้งานได้จาก localStorage แต่ข้อมูล NA จะยังไม่ sync ขึ้น Google Sheet
>
> 🔒 หมายเหตุความเป็นส่วนตัว: การซ่อนข้อมูลพยาบาลจาก NA เป็นการกรองที่ฝั่ง UI (role `assistant` ไม่เห็นแท็บ/หน้าจอของพยาบาล) ตัว endpoint `/api/data` ปัจจุบันยังส่งข้อมูลทั้งก้อน หากต้องการกันระดับเครือข่ายจริง ต้องเพิ่มการกรองตาม role ที่ Worker/Apps Script

## Secrets ที่ต้องตั้ง (Cloudflare)

ค่าลับทั้งหมด **ไม่เก็บในไฟล์** แต่เก็บเป็น Secret บน Cloudflare — ตั้งครั้งเดียวแล้วอยู่ถาวร
ทุกครั้งที่ deploy จะไม่ถูกลบ ตั้งได้ทาง Dashboard (Worker → Settings → Variables and Secrets)
หรือ CLI:

```bash
npx wrangler secret put APPS_SCRIPT_URL     # Web App URL (/exec) ของ Apps Script
npx wrangler secret put APPS_SCRIPT_TOKEN   # ต้องตรงกับ SECRET_TOKEN ใน apps_script_backend.gs
npx wrangler secret put SESSION_SECRET      # สตริงสุ่มยาวๆ สำหรับเซ็น session JWT
# เฉพาะตอนทำ LINE Login:
npx wrangler secret put LINE_CHANNEL_ID
npx wrangler secret put LINE_CHANNEL_SECRET
```

## Deploy

### แบบ push-to-deploy (Workers Builds) — แนะนำ
เชื่อม repo นี้กับ Worker ใน Cloudflare Dashboard:
Worker → Settings → **Builds → Connect** → เลือก repo + branch `main`
(Deploy command: `npx wrangler deploy`) — จากนั้นทุก `git push` จะ deploy อัตโนมัติ

### แบบ manual
```bash
npx wrangler deploy
```

## Google Apps Script (ฐานข้อมูล)
1. เปิด Google Sheet → Extensions → Apps Script → วางโค้ดจาก `apps_script_backend.gs`
2. ตั้งค่า `SECRET_TOKEN` เป็นรหัสลับของคุณเอง (ค่าเดียวกับ Secret `APPS_SCRIPT_TOKEN`)
3. Deploy → Web app (Execute as: Me, Who has access: Anyone) → คัดลอก URL ไปตั้งเป็น `APPS_SCRIPT_URL`

## ⚠️ ความปลอดภัย
- ห้าม commit ค่า secret ใดๆ (token, URL, channel secret) ขึ้น repo — ใช้ Cloudflare Secret เท่านั้น
- รหัสผ่านผู้ใช้ระบบเก็บแบบ plaintext ในชีต — เหมาะกับใช้งานภายในองค์กรเท่านั้น
