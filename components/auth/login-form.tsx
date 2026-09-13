"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/client/api";

export function LoginForm({
  endpoint,
  redirectTo,
  title,
  subtitle,
  logo,
  footer,
}: {
  endpoint: string;
  redirectTo: string;
  title: string;
  subtitle: string;
  logo: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api(endpoint, { body: { username, password } });
      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(1200px_600px_at_100%_-10%,var(--color-brand-100),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 [&>span]:size-16 [&>span]:rounded-2xl [&_svg]:size-8">{logo}</div>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1 text-ink-soft">{subtitle}</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="ชื่อผู้ใช้" htmlFor="username">
            <Input id="username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="รหัสผ่าน" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-mute hover:text-ink"
                aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {!loading && <LogIn />} เข้าสู่ระบบ
          </Button>
        </form>
        {footer && <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>}
      </div>
    </div>
  );
}
