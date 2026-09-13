import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { NurseLogo } from "@/components/shell/nurse-shell";

export const metadata = { title: "เข้าสู่ระบบ — ระบบจัดเวรพยาบาล" };

export default function LoginPage() {
  return (
    <LoginForm
      endpoint="/api/auth/login"
      redirectTo="/"
      title="ระบบจัดเวรพยาบาล"
      subtitle="โรงพยาบาลลำพูน"
      logo={<NurseLogo />}
      footer={
        <>
          ผู้ช่วยพยาบาล (NA)?{" "}
          <Link href="/na/login" className="font-semibold text-brand-700 hover:underline">
            เข้าระบบ NA
          </Link>
        </>
      }
    />
  );
}
