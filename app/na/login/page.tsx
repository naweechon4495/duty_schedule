import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { NALogo, NATheme } from "@/components/shell/na-shell";

export const metadata = { title: "เข้าสู่ระบบ — ระบบจัดเวรผู้ช่วยพยาบาล" };

export default function NALoginPage() {
  return (
    <div className="theme-na">
      <NATheme />
      <LoginForm
        endpoint="/api/na/auth/login"
        redirectTo="/na"
        title="ระบบจัดเวรผู้ช่วยพยาบาล"
        subtitle="NA · โรงพยาบาลลำพูน"
        logo={<NALogo />}
        footer={
          <>
            พยาบาล?{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">
              เข้าระบบพยาบาล
            </Link>
          </>
        }
      />
    </div>
  );
}
