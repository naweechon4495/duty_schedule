"use client";

import { History, KeyRound, Pencil, Plus, Search, Trash2, UserCog } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { RequirePage } from "@/components/shell/nurse-shell";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input, Select } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { ROLE_LABELS } from "@/lib/domain/roles";
import type { PublicUser, Role } from "@/lib/types";

export default function UsersPage() {
  return (
    <RequirePage page="users">
      <UsersInner />
    </RequirePage>
  );
}

function UsersInner() {
  const { users, nurses, me, mutate } = useNurseData();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<PublicUser | null | undefined>(undefined);
  const [resetting, setResetting] = useState<PublicUser | null>(null);
  const nurseByCode = useMemo(() => new Map(nurses.map((n) => [n.code, n])), [nurses]);

  const list = users.filter((u) => (!role || u.role === role) && (!q.trim() || (u.username + " " + u.fullname).toLowerCase().includes(q.trim().toLowerCase())));

  const remove = async (u: PublicUser) => {
    if (await confirmDialog({ title: `ลบผู้ใช้ ${u.username}?`, message: "ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้อีก", confirmText: "ลบ", tone: "danger" }))
      mutate(() => api(`/api/users/${encodeURIComponent(u.username)}`, { method: "DELETE" }), "ลบผู้ใช้แล้ว");
  };

  return (
    <div>
      <PageHeader
        title="ผู้ใช้ระบบ"
        description={`${users.length} บัญชี · ผู้ดูแลระบบจัดการทุกอย่าง · ผู้อนุมัติอนุมัติคำขอ/จัดเวร · ผู้ยื่นคำขอยื่นแลกเวร/ลา`}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus /> เพิ่มผู้ใช้
          </Button>
        }
      />
      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <div className="relative col-span-2 sm:w-72">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา" className="pl-9" />
            </div>
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="บทบาท" className="sm:w-44">
              <option value="">ทุกบทบาท</option>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<UserCog />} title="ไม่พบผู้ใช้" />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {list.map((u) => {
                const linked = u.nurseCode ? nurseByCode.get(u.nurseCode) : null;
                return (
                  <li key={u.username} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{u.fullname}</span>
                        <RoleBadge role={u.role} label={ROLE_LABELS[u.role]} />
                        {u.username === me.username && <span className="text-xs text-brand-700">(คุณ)</span>}
                      </div>
                      <div className="text-sm text-ink-soft">
                        {u.username}
                        {u.nurseCode && (linked ? ` · ผูกกับ ${linked.code} ${linked.name}` : <span className="text-rose-700"> · รหัส {u.nurseCode} (ไม่พบพยาบาล)</span>)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="ตั้งรหัสผ่านใหม่" title="ตั้งรหัสผ่านใหม่" onClick={() => setResetting(u)}>
                        <KeyRound />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="แก้ไข" onClick={() => setEditing(u)}>
                        <Pencil />
                      </Button>
                      {u.username !== me.username && (
                        <Button size="icon-sm" variant="ghost" aria-label="ลบ" onClick={() => remove(u)}>
                          <Trash2 className="text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
      {editing !== undefined && <UserDialog user={editing} onClose={() => setEditing(undefined)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function UserDialog({ user, onClose }: { user: PublicUser | null; onClose: () => void }) {
  const { nurses, mutate } = useNurseData();
  const [username, setUsername] = useState(user?.username || "");
  const [fullname, setFullname] = useState(user?.fullname || "");
  const [role, setRole] = useState<Role>(user?.role || "requester");
  const [nurseCode, setNurseCode] = useState(user?.nurseCode || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const items = [
    { value: "", label: "— ไม่ผูก —" },
    ...nurses
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, "th", { numeric: true }))
      .map((n) => ({ value: n.code, label: `${n.code} ${n.name}` })),
  ];
  const valid = fullname.trim() && (user || (username.trim() && password.length >= 6));

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={user ? `แก้ไขผู้ใช้ ${user.username}` : "เพิ่มผู้ใช้"}
      footer={
        <>
          {user && (
            <Link href={`/logs?entity=user&entityId=${encodeURIComponent(user.username)}`} className="mr-auto hidden items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline sm:inline-flex">
              <History className="size-4" /> ประวัติ
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={!valid}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await mutate(
                () =>
                  user
                    ? api(`/api/users/${encodeURIComponent(user.username)}`, { method: "PUT", body: { fullname, role, nurseCode } })
                    : api("/api/users", { body: { username, password, fullname, role, nurseCode } }),
                "บันทึกผู้ใช้แล้ว",
              );
              setSaving(false);
              if (ok) onClose();
            }}
          >
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!user && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อผู้ใช้ *" hint="a-z, 0-9, _ . @ -">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="off" />
            </Field>
            <Field label="รหัสผ่าน *" hint="อย่างน้อย 6 ตัวอักษร">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
        )}
        <Field label="ชื่อ-นามสกุล *">
          <Input value={fullname} onChange={(e) => setFullname(e.target.value)} />
        </Field>
        <Field label="บทบาท">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <ChoiceChip key={r} type="radio" name="role" checked={role === r} onChange={() => setRole(r)}>
                {ROLE_LABELS[r]}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        <Field label="ผูกกับพยาบาล" hint="ให้ระบบรู้ว่าเวร/การลาของบัญชีนี้เป็นของใคร">
          <Combobox items={items} value={nurseCode} onChange={setNurseCode} placeholder="— ไม่ผูก —" />
        </Field>
        {user && <Alert tone="info">รหัสผ่านถูกเข้ารหัสไว้ ดูไม่ได้ — ใช้ปุ่มกุญแจเพื่อตั้งรหัสผ่านใหม่</Alert>}
      </div>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { mutate } = useNurseData();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const mismatch = pw2 && pw !== pw2;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`ตั้งรหัสผ่านใหม่ — ${user.username}`}
      description={user.fullname}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={pw.length < 6 || pw !== pw2}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await mutate(() => api(`/api/users/${encodeURIComponent(user.username)}/password`, { body: { password: pw } }), "ตั้งรหัสผ่านใหม่แล้ว");
              setSaving(false);
              if (ok) onClose();
            }}
          >
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 6 ตัวอักษร">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="ยืนยันรหัสผ่านใหม่">
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        {mismatch && <Alert tone="danger">รหัสผ่านไม่ตรงกัน</Alert>}
        <p className="text-sm text-ink-soft">ผู้ใช้นี้จะถูกออกจากระบบทุกเครื่อง แล้วต้องเข้าด้วยรหัสใหม่</p>
      </div>
    </Dialog>
  );
}
