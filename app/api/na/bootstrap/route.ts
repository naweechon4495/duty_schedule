import type { NABootstrapData } from "@/lib/types";
import { requireNA } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { listAssistants } from "@/lib/server/repo/assistants";
import { listHolidays, listNAUsers } from "@/lib/server/repo/misc";
import { listNALeaves, listSwaps } from "@/lib/server/repo/requests";
import { NA_SLOTS, loadSchedule } from "@/lib/server/repo/schedule";

export const dynamic = "force-dynamic";

/** ข้อมูลตั้งต้นของแอป NA — ไม่มีข้อมูลระบบพยาบาลปนเลย (ยกเว้นวันหยุดพิเศษที่ใช้ร่วมกัน) */
export const GET = route(async (req) => {
  const actor = await requireNA(req);
  const [assistants, schedule, swaps, leaves, holidays, users] = await Promise.all([
    listAssistants(),
    loadSchedule(NA_SLOTS),
    listSwaps("na_swaps"),
    listNALeaves(),
    listHolidays(),
    listNAUsers(),
  ]);
  const data: NABootstrapData = { me: actor.user, assistants, schedule, swaps, leaves, holidays, users };
  return json(data);
});
