# ระบบจัดเวรพยาบาล โรงพยาบาลลำพูน

Lamphun Hospital Nurse Scheduling System — เว็บแอปจัดตารางเวรอัตโนมัติ
โฮสต์บน Cloudflare Workers และใช้ Google Sheets เป็นฐานข้อมูล

ระบบแบ่งเป็น **2 แอปแยกกันโดยสิ้นเชิง** ใช้ชีตเดียวกัน (คนละแท็บ) แต่แยก endpoint กัน:

| แอป | URL | สำหรับ |
|-----|-----|--------|
| ระบบพยาบาล | `/` | พยาบาล (admin / approver / requester) |
| ระบบผู้ช่วยพยาบาล (NA) | `/na/` | ผู้ช่วยพยาบาล (naadmin / assistant) |

ทั้งสองแอปไม่เห็นข้อมูลของกันและกัน — Cloudflare Worker กรอง key แยกให้ที่ระดับเครือข่าย
(`/api/data` คืนเฉพาะข้อมูลพยาบาล · `/api/na` คืนเฉพาะข้อมูล NA)

## โครงสร้างโปรเจกต์

| ไฟล์ | หน้าที่ |
|------|---------|
| `public/index.html` | **แอปพยาบาล** — โครงหลัก (CSS + JS ทั้งหมด) + โครง `<div>` ของแต่ละแท็บ (ว่าง) ที่โหลดเนื้อหาจากไฟล์ย่อยตอน runtime |
| `public/partials/login.html` | หน้าเข้าสู่ระบบของแอปพยาบาล |
| `public/panels/*.html` | โครงแต่ละแท็บของแอปพยาบาล (`home`, `nurses`, `calendar`, `schedule`, `holidays`, `swap`, `leave`, `stats`, `settings`, `users`) |
| `public/na/index.html` | **แอปผู้ช่วยพยาบาล (NA)** — แยกเป็นอีกแอปหนึ่ง มีล็อกอิน/ผู้ใช้/ข้อมูลของตัวเอง |
| `public/na/partials/login.html` | หน้าเข้าสู่ระบบของแอป NA |
| `public/na/panels/*.html` | โครงแต่ละแท็บของแอป NA (`home`, `calendar`, `swap`, `leave`, `stats`, `assistants`, `schedule`, `users`) |
| `src/worker.js` | Cloudflare Worker — ตัวกลางคุยกับ Google Sheet โดยเก็บ token ไว้ฝั่งเซิร์ฟเวอร์ และกรอง key แยกให้ 2 endpoint (`/api/data`, `/api/na`) |
| `apps_script_backend.gs` | โค้ด Google Apps Script — วางในชีต แล้ว Deploy เป็น Web App เพื่อทำหน้าที่ REST API อ่าน/เขียนแต่ละแท็บ |
| `wrangler.toml` | คอนฟิก Cloudflare Worker (ไม่มีความลับ — ค่าลับทั้งหมดเป็น Secret) |

> 🧩 **สถาปัตยกรรมหน้าเว็บ:** แต่ละแอปเก็บ CSS/JS ไว้ในไฟล์ `index.html` ของตัวเอง แต่ **โครงสร้าง HTML ของแต่ละส่วนแยกเป็นไฟล์ย่อย** — เมื่อเปิดแอป ฟังก์ชัน `loadPartials()` จะ `fetch` ไฟล์เหล่านี้ (ตาม attribute `data-src`) มาฉีดเข้า DOM ก่อนเริ่มทำงาน ไฟล์ย่อยถูกเสิร์ฟเป็น static asset ตามปกติ (ไม่ต้องมี build step)

## ฟีเจอร์

### แอปพยาบาล (`/`)
- จัดการข้อมูลพยาบาล 4 รุ่น + เงื่อนไขวัน/กะที่ไม่สะดวก 8 รูปแบบ
- จัดเวรอัตโนมัติตามกฎ (ทีมไม่ซ้ำรุ่น, รุ่น 4 = Pre-op, เฉลี่ยแต่ละกะ, ดึก On call, บ่ายวันนี้ไม่ต่อดึกวันถัดไป)
- ปฏิทินรายเดือน + Export PDF/CSV/Excel + หน้าแรก "ตารางเวรของฉัน"
- ระบบแลกเวร/ยกเวรพร้อมการอนุมัติ, สถิติรายบุคคล (รวมสถิติวันหยุด)
- ระบบวันลา (ลากิจ/ลาป่วย/ลาพักร้อน) + แนะนำคนขึ้นแทนเมื่อลาป่วยทับเวร
- เพิ่มเวรกำหนดเอง (ชื่อ/กะ/ช่วงวัน + สุ่มคนว่าง)
- ผูกบัญชีผู้ใช้กับพยาบาลด้วยรหัส · ล็อกอิน username/password
- 3 บทบาท: admin / approver / requester

### แอปผู้ช่วยพยาบาล NA (`/na/`)
- แยกจากระบบพยาบาลโดยสิ้นเชิง — มีระบบผู้ใช้/ล็อกอิน/ข้อมูลของตัวเอง
- จัดการรายชื่อ NA + จัดเวรอัตโนมัติ (เช้า/บ่าย/ดึก + เช้าทำการ, เฉลี่ยเท่ากัน, เลี่ยงวันลา/วันไม่สะดวก, บ่าย→ไม่ต่อดึกวันถัดไป)
- ปฏิทิน NA, หน้าแรก "เวรของฉัน", แลก/ยกเวร NA, วันลา NA, สถิติ NA
- 2 บทบาท: **naadmin** (จัดการทั้งหมด) / **assistant** (ดูเวร/ลา/แลกเวรของตัวเอง)
- บัญชีผู้ดูแลเริ่มต้น: `naadmin` / `naadmin123` — **เปลี่ยนรหัสผ่านหลังใช้งานครั้งแรก**

> ⚠️ **หลังอัปเดตนี้ต้อง redeploy Apps Script** (`apps_script_backend.gs`) หนึ่งครั้ง เพราะเพิ่มตาราง `Assistants` / `NASchedule` / `NASwaps` / `NALeaves` / `NAUsers` — ก่อน redeploy แอปยังใช้งานได้จาก localStorage แต่ข้อมูลจะยังไม่ sync ขึ้น Google Sheet
>
> 🔒 **การแยกข้อมูล:** แอป NA เรียกเฉพาะ `/api/na` และแอปพยาบาลเรียกเฉพาะ `/api/data` โดย Worker กรอง key ให้แต่ละฝั่งเห็นเฉพาะข้อมูลของตน (ฝั่ง NA ไม่ได้รับข้อมูลพยาบาลแม้แต่ระดับเครือข่าย และ NA เขียนได้เฉพาะข้อมูล NA) — วันหยุดพิเศษ (`customHolidays`) ใช้ร่วมกันแบบอ่านอย่างเดียว (ฝั่งพยาบาลเป็นผู้ตั้ง) เพื่อให้จัดเวร NA คำนวณวันหยุดได้ถูกต้อง

## Secrets ที่ต้องตั้ง (Cloudflare)

ค่าลับทั้งหมด **ไม่เก็บในไฟล์** แต่เก็บเป็น Secret บน Cloudflare — ตั้งครั้งเดียวแล้วอยู่ถาวร
ทุกครั้งที่ deploy จะไม่ถูกลบ ตั้งได้ทาง Dashboard (Worker → Settings → Variables and Secrets)
หรือ CLI:

```bash
npx wrangler secret put APPS_SCRIPT_URL     # Web App URL (/exec) ของ Apps Script
npx wrangler secret put APPS_SCRIPT_TOKEN   # ต้องตรงกับ SECRET_TOKEN ใน apps_script_backend.gs
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
- ห้าม commit ค่า secret ใดๆ (token, URL) ขึ้น repo — ใช้ Cloudflare Secret เท่านั้น
- รหัสผ่านผู้ใช้ระบบเก็บแบบ plaintext ในชีต — เหมาะกับใช้งานภายในองค์กรเท่านั้น
