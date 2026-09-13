"use client";

import { Dialog as D, DropdownMenu } from "radix-ui";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
  badge?: number;
  /** แสดงในแถบล่างของมือถือ (สูงสุด 3 รายการ + ปุ่มเมนู) */
  mobile?: boolean;
}

interface ShellProps {
  title: string;
  subtitle: string;
  logo: React.ReactNode;
  nav: NavItem[];
  user: { fullname: string; roleLabel: string };
  onLogout: () => void;
  basePath?: string;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string, basePath: string) {
  if (href === basePath || href === basePath + "/") return pathname === basePath || pathname === basePath + "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function initials(name: string) {
  const clean = name.trim().replace(/^(นาย|นางสาว|นาง|น\.ส\.|นส\.|รตต\.|พญ\.|นพ\.)\s*/, "");
  return clean.charAt(0) || "?";
}

function BadgeDot({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-none text-white", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function UserMenu({ user, onLogout, compact }: { user: ShellProps["user"]; onLogout: () => void; compact?: boolean }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={cn("flex min-h-11 items-center gap-2.5 rounded-xl text-left hover:bg-canvas", compact ? "p-1" : "w-full p-2")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-base font-bold text-white">{initials(user.fullname)}</span>
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{user.fullname}</span>
              <span className="block truncate text-xs text-ink-soft">{user.roleLabel}</span>
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)]">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold text-ink">{user.fullname}</div>
            <div className="text-xs text-ink-soft">{user.roleLabel}</div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={onLogout}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-rose-700 outline-none data-[highlighted]:bg-rose-50"
          >
            <LogOut className="size-4" /> ออกจากระบบ
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * โครงหน้าแอป 3 ขนาดจอ
 * - Desktop (≥1024): sidebar เต็มแบ่งกลุ่มเมนู
 * - Tablet (768–1023): icon rail ซ้าย
 * - Mobile (<768): แถบบนแสดงชื่อหน้า + แถบล่าง 4 ปุ่ม (ปุ่ม "เมนู" เปิดรายการทั้งหมด)
 */
export function AppShell({ title, subtitle, logo, nav, user, onLogout, basePath = "", children }: ShellProps) {
  const pathname = usePathname() || "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const home = basePath || "/";
  const groups = [...new Set(nav.map((n) => n.group))];
  const current = nav.find((n) => isActive(pathname, n.href, basePath));
  const mobileItems = nav.filter((n) => n.mobile).slice(0, 3);
  const moreBadge = nav.filter((n) => !n.mobile).reduce((s, n) => s + (n.badge || 0), 0);

  return (
    <div className="min-h-dvh">
      {/* ===== Desktop sidebar ===== */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <Link href={home} className="flex items-center gap-3 px-5 py-5">
          {logo}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold leading-tight text-ink">{title}</span>
            <span className="block truncate text-xs text-ink-soft">{subtitle}</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g}>
              <div className="px-3 pb-1.5 text-xs font-bold tracking-wide text-ink-mute">{g}</div>
              <div className="space-y-0.5">
                {nav
                  .filter((n) => n.group === g)
                  .map((n) => {
                    const active = isActive(pathname, n.href, basePath);
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                          active ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-canvas hover:text-ink",
                        )}
                      >
                        <n.icon className={cn("size-5", active ? "text-brand-600" : "text-ink-mute")} />
                        <span className="flex-1">{n.label}</span>
                        <BadgeDot n={n.badge} />
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </aside>

      {/* ===== Tablet icon rail ===== */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r border-line bg-surface py-3 md:flex lg:hidden">
        <Link href={home} className="mb-3" aria-label="หน้าแรก">
          {logo}
        </Link>
        <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
          {nav.map((n) => {
            const active = isActive(pathname, n.href, basePath);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className={cn(
                  "relative flex w-full flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold",
                  active ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-canvas",
                )}
              >
                <n.icon className={cn("size-5", active ? "text-brand-600" : "text-ink-mute")} />
                <span className="w-full truncate text-center">{n.label}</span>
                <BadgeDot n={n.badge} className="absolute top-1 right-2 h-4 min-w-4 text-[10px]" />
              </Link>
            );
          })}
        </nav>
        <UserMenu user={user} onLogout={onLogout} compact />
      </aside>

      {/* ===== Mobile top bar ===== */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur md:hidden">
        <Link href={home} aria-label="หน้าแรก">
          {logo}
        </Link>
        <div className="min-w-0 flex-1 truncate text-base font-bold text-ink">{current?.label || title}</div>
        <UserMenu user={user} onLogout={onLogout} compact />
      </header>

      <main className="md:pl-20 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-3 pt-4 pb-28 sm:px-5 md:px-6 md:pt-6 md:pb-10">{children}</div>
      </main>

      {/* ===== Mobile bottom nav ===== */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {mobileItems.map((n) => {
          const active = isActive(pathname, n.href, basePath);
          return (
            <Link key={n.href} href={n.href} className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", active ? "text-brand-700" : "text-ink-soft")}>
              <n.icon className={cn("size-6", active && "text-brand-600")} />
              {n.label}
              <BadgeDot n={n.badge} className="absolute top-1.5 left-1/2 ml-2 h-4 min-w-4 text-[10px]" />
            </Link>
          );
        })}
        <D.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <D.Trigger className="relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-ink-soft">
            <Menu className="size-6" />
            เมนู
            <BadgeDot n={moreBadge} className="absolute top-1.5 left-1/2 ml-2 h-4 min-w-4 text-[10px]" />
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-40 bg-slate-950/40 data-[state=open]:animate-fade-in" />
            <D.Content className="pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface p-4 data-[state=open]:animate-slide-up">
              <div className="mb-3 flex items-center">
                <D.Title className="flex-1 text-lg font-bold">เมนูทั้งหมด</D.Title>
                <D.Description className="sr-only">รายการเมนูของระบบ</D.Description>
                <D.Close className="grid size-10 place-items-center rounded-full hover:bg-canvas" aria-label="ปิด">
                  <X className="size-5" />
                </D.Close>
              </div>
              {groups.map((g) => (
                <div key={g} className="mb-4">
                  <div className="mb-2 text-xs font-bold text-ink-mute">{g}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {nav
                      .filter((n) => n.group === g)
                      .map((n) => {
                        const active = isActive(pathname, n.href, basePath);
                        return (
                          <Link
                            key={n.href}
                            href={n.href}
                            onClick={() => setMenuOpen(false)}
                            className={cn(
                              "relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-sm font-semibold",
                              active ? "border-brand-200 bg-brand-50 text-brand-800" : "border-line text-ink",
                            )}
                          >
                            <n.icon className="size-6 text-brand-600" />
                            {n.label}
                            <BadgeDot n={n.badge} className="absolute top-1.5 right-1.5" />
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
            </D.Content>
          </D.Portal>
        </D.Root>
      </nav>
    </div>
  );
}
