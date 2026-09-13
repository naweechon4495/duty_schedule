import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NAAppShell } from "@/components/shell/na-shell";
import { SESSION_COOKIE, sessionUsername } from "@/lib/server/auth";
import { loadNAUser } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "ระบบจัดเวรผู้ช่วยพยาบาล (NA)" };

/** แอป NA: login แยกจากระบบพยาบาล (cookie คนละตัว บัญชีคนละชุด) */
export default async function NALayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE.na)?.value;
  const username = await sessionUsername("na", token);
  if (!username || !(await loadNAUser(username))) redirect("/na/login");
  return <NAAppShell>{children}</NAAppShell>;
}
