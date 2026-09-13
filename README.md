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

## Deploy

| ปลายทาง | Worker | D1 |
|---|---|---|
| preview (ทดสอบ) | `nawee-duty-schedule-preview` | `nawee-db-preview` |
| production | `nawee-duty-schedule` | `nawee-db` |

```bash
# preview — build ด้วย env preview แล้ว deploy ด้วย config ที่ build ได้ (ตรวจชื่อ worker ก่อนเสมอ)
CLOUDFLARE_ENV=preview npx vinext build
node -e "console.log(require('./dist/server/wrangler.json').name)"   # ต้องเป็น nawee-duty-schedule-preview
npx wrangler deploy --config dist/server/wrangler.json
```

> ⚠️ `vinext-cloudflare deploy` จะ **build ใหม่เอง** — ถ้าไม่ได้ส่ง `--preview` จะไปลง production ทันที
> สคริปต์ `npm run deploy` จึงถูกปิดไว้ ให้ใช้ `deploy:preview` / `deploy:production` ที่ระบุปลายทางชัดเจน

**Workers Builds:** repo นี้ต่อกับ Cloudflare Workers Builds ไว้ (push เข้า `main` = deploy production อัตโนมัติ)
ก่อน merge ต้องแก้คำสั่งใน Dashboard → Worker → Settings → Builds เป็น build `npx vinext build` / deploy `npx wrangler deploy --config dist/server/wrangler.json`

## สลับจากระบบเดิม (Google Sheet) มา D1

1. แจ้งผู้ใช้หยุดแก้ข้อมูลในระบบเดิมชั่วคราว
2. ดึง snapshot: `/api/data` → `scripts/data/nurse.json`, `/api/na` → `scripts/data/na.json`
3. `node scripts/migrate-from-sheet.mjs` (ถ้าไม่มีบัญชี NA จะสร้าง `naadmin` พร้อมรหัสสุ่ม — ดูใน output)
4. `npm run db:migrate:production` แล้ว `npx wrangler d1 execute nawee-db --remote --file scripts/data/seed.sql`
5. ตั้งค่า Workers Builds (ด้านบน) → merge เข้า `main`
6. ถ้ามีปัญหา: `npx wrangler rollback <version เดิม> --name nawee-duty-schedule` — ระบบเดิมยังอ่าน Google Sheet ได้ตามเดิม
