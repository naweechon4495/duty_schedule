import type { BootstrapData } from "@/lib/types";
import { requireNurse } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { listHolidays, listUsers } from "@/lib/server/repo/misc";
import { listNurses } from "@/lib/server/repo/nurses";
import { listLeaves, listSwaps } from "@/lib/server/repo/requests";
import { loadSchedule } from "@/lib/server/repo/schedule";

export const dynamic = "force-dynamic";

/** ข้อมูลตั้งต้นทั้งหมดของหน้าเว็บ (ไม่มีรหัสผ่าน/hash เลย) */
export const GET = route(async (req) => {
  const actor = await requireNurse(req);
  const [nurses, schedule, swaps, leaves, holidays, users] = await Promise.all([
    listNurses(),
    loadSchedule(),
    listSwaps(),
    listLeaves(),
    listHolidays(),
    listUsers(),
  ]);
  const data: BootstrapData = {
    me: actor.user,
    nurses,
    schedule,
    swaps,
    leaves,
    holidays,
    users: actor.user.role === "admin" ? users : users.map((u) => ({ ...u, nurseCode: "" })),
  };
  return json(data);
});
