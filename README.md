# ระบบจัดเวร โรงพยาบาลลำพูน

ระบบจัดตารางเวร **พยาบาล** และ **ผู้ช่วยพยาบาล (NA)** — Next.js (vinext) บน Cloudflare Workers + ฐานข้อมูล Cloudflare D1

| ส่วน | URL | บัญชีผู้ใช้ |
|---|---|---|
| ระบบพยาบาล | `/` (login ที่ `/login`) | ตาราง `users` |
| ระบบ NA | `/na` (login ที่ `/na/login`) | ตาราง `na_users` (แยกกันโดยสิ้นเชิง) |

## โครงสร้าง

```
app/                    หน้าเว็บ (App Router)
  (app)/                หน้าระบบพยาบาล — ตรวจ session ใน layout.tsx
  na/(app)/             หน้าระบบ NA
  api/                  API (route handlers) — ทุกคำขอตรวจ session + บทบาทที่เซิร์ฟเวอร์
components/             UI (Tailwind + Radix) แยก ui/ shell/ calendar/ ...
lib/domain/             business logic ล้วน (จัดเวรอัตโนมัติ, วันหยุด, ลา, แลกเวร) — ใช้ร่วม server/client
lib/server/             D1, auth (PBKDF2 + session cookie), audit log, repositories
migrations/             D1 schema
scripts/migrate-from-sheet.mjs   ย้ายข้อมูลจาก Google Sheet เดิม → SQL
tests/                  vitest (กติกาจัดเวร)
legacy/                 ระบบเดิม (HTML + Apps Script) เก็บไว้อ้างอิงระหว่างสลับระบบ
```

**หลักการสำคัญ**
- บันทึกทีละรายการ (ไม่ส่งข้อมูลทั้งชุดไปทับแบบระบบเดิม) — แก้พร้อมกันหลายเครื่องได้โดยข้อมูลไม่หาย
- ทุกการแก้ไขเขียน `audit_log` ใน transaction เดียวกัน → ดูได้ที่หน้า **Log**
- รหัสผ่านเก็บเป็น PBKDF2 hash, session เป็น cookie HttpOnly, API ไม่เคยส่งรหัสผ่าน/hash ออกไป
- ตารางเวรเขียนทั้งเดือนด้วย 2 คำสั่ง (`DELETE` + `INSERT … json_each`) เพื่อไม่ชนเพดานจำนวน query ต่อ request
- **สำรองตารางเวร** (`schedule_snapshots`, หน้าจัดเวร): ก่อนจัดเวรอัตโนมัติ / ล้าง / กู้คืน / Import ระบบสำรองเดือนนั้นไว้ใน batch เดียวกันเสมอ (เก็บอัตโนมัติล่าสุด 20 ชุดต่อเดือน) และกดบันทึกเองได้ — ดู, ดาวน์โหลด Excel, กู้คืนได้

## พัฒนาในเครื่อง

```bash
npm install
npm run db:migrate:local
npm run dev            # http://localhost:3000
npm test               # vitest
npm run typecheck
```

ข้อมูลทดสอบในเครื่อง: `node scripts/migrate-from-sheet.mjs` แล้ว `npx wrangler d1 execute nawee-db --local --file scripts/data/seed.sql`

> ⚠️ `scripts/data/` มีรหัสผ่านและเบอร์โทร — อยู่ใน `.gitignore` ห้าม commit

## Deploy (เว็บจริงอย่างเดียว)

| Worker | D1 |
|---|---|
| `nawee-duty-schedule` | `nawee-db` |

**อัตโนมัติ:** repo ต่อกับ Cloudflare Workers Builds — push เข้า `main` = deploy เว็บจริง
ตั้งค่าใน Dashboard → Worker → Settings → Build:
- Build command: `npx vinext build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Builds for non-production branches: ปิด (ไม่งั้นทุก branch จะได้ URL ที่ผูกกับฐานข้อมูลจริง)

**จากเครื่อง:** `npm run deploy` (บัญชี wrangler ต้องเป็นเจ้าของ account `c80895cd…` — ตรวจด้วย `npx wrangler whoami`)

**แก้ schema:** เพิ่มไฟล์ใน `migrations/` แล้ว `npm run db:migrate` — **ต้องรันก่อน deploy โค้ดที่ใช้ตารางใหม่** (Workers Builds ไม่รัน migration ให้)

**ย้อนเวอร์ชันโค้ด:** `npx wrangler deployments list` แล้ว `npx wrangler rollback <version> --name nawee-duty-schedule`

> เว็บทดสอบ (preview) ปิดไว้ใน `wrangler.jsonc` — ดูวิธีเปิดกลับได้ในคอมเมนต์ของไฟล์

## ประวัติการย้ายระบบ

ย้ายจาก Google Sheet มา D1 เมื่อ 14 ก.ย. 2569 ด้วย `scripts/migrate-from-sheet.mjs`
(ถ้าในชีตไม่มีบัญชี NA สคริปต์จะสร้าง `naadmin` พร้อมรหัสสุ่ม) — Google Sheet/Apps Script เดิมเก็บไว้เป็นไฟล์สำรองเท่านั้น
