import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NurseAppShell } from "@/components/shell/nurse-shell";
import { SESSION_COOKIE, sessionUsername } from "@/lib/server/auth";
import { loadNurseUser } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

/** ทุกหน้าในกลุ่มนี้ต้อง login ระบบพยาบาลก่อน (ตรวจที่เซิร์ฟเวอร์) */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE.nurse)?.value;
  const username = await sessionUsername("nurse", token);
  if (!username || !(await loadNurseUser(username))) redirect("/login");
  return <NurseAppShell>{children}</NurseAppShell>;
}
