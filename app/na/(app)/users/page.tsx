"use client";

import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNAData } from "@/components/data/na-data";
import { RequireNAAdmin } from "@/components/shell/na-shell";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChip, Field, Input } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { NA_ROLE_LABELS } from "@/lib/domain/roles";
import type { NAPublicUser, NARole } from "@/lib/types";

export default function NAUsersPage() {
  return (
    <RequireNAAdmin>
      <Inner />
    </RequireNAAdmin>
  );
}

function Inner() {
  const { users, assistants, me, mutate } = useNAData();
  const [editing, setEditing] = useState<NAPublicUser | null | undefined>(undefined);
  const [resetting, setResetting] = useState<NAPublicUser | null>(null);
  return (
    <div>
      <PageHeader
        title="ผู้ใช้ระบบ NA"
        description={`${users.length} บัญชี (แยกจากระบบพยาบาล)`}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus /> เพิ่มผู้ใช้
          </Button>
        }
      />
      <Card>
        <CardBody>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {users.map((u) => {
              const linked = assistants.find((a) => a.code === u.assistantCode);
              return (
                <li key={u.username} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{u.fullname}</span>
                      <RoleBadge role={u.role} label={NA_ROLE_LABELS[u.role]} />
                    </div>
                    <div className="text-sm text-ink-soft">
                      {u.username}
                      {u.assistantCode && ` · ผูกกับ ${linked ? linked.name : u.assistantCode + " (ไม่พบ)"}`}
                    </div>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="ตั้งรหัสผ่านใหม่" onClick={() => setResetting(u)}>
                    <KeyRound />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="แก้ไข" onClick={() => setEditing(u)}>
                    <Pencil />
                  </Button>
                  {u.username !== me.username && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="ลบ"
                      onClick={async () =>
                        (await confirmDialog({ title: `ลบผู้ใช้ ${u.username}?`, confirmText: "ลบ", tone: "danger" })) &&
                        mutate(() => api(`/api/na/users/${encodeURIComponent(u.username)}`, { method: "DELETE" }), "ลบผู้ใช้แล้ว")
                      }
                    >
                      <Trash2 className="text-rose-600" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
      {editing !== undefined && <UserDialog user={editing} onClose={() => setEditing(undefined)} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function UserDialog({ user, onClose }: { user: NAPublicUser | null; onClose: () => void }) {
  const { assistants, mutate } = useNAData();
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState(user?.fullname || "");
  const [role, setRole] = useState<NARole>(user?.role || "assistant");
  const [assistantCode, setCode] = useState(user?.assistantCode || "");
  const [saving, setSaving] = useState(false);
  const valid = fullname.trim() && (user || (username.trim() && password.length >= 6));
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={user ? `แก้ไขผู้ใช้ ${user.username}` : "เพิ่มผู้ใช้ NA"}
      footer={
        <>
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
                    ? api(`/api/na/users/${encodeURIComponent(user.username)}`, { method: "PUT", body: { fullname, role, assistantCode } })
                    : api("/api/na/users", { body: { username, password, fullname, role, assistantCode } }),
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อผู้ใช้ *">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
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
          <div className="flex gap-2">
            {(Object.keys(NA_ROLE_LABELS) as NARole[]).map((r) => (
              <ChoiceChip key={r} type="radio" name="na-role" checked={role === r} onChange={() => setRole(r)}>
                {NA_ROLE_LABELS[r]}
              </ChoiceChip>
            ))}
          </div>
        </Field>
        {role === "assistant" && (
          <Field label="ผูกกับรายชื่อ NA">
            <Combobox items={[{ value: "", label: "— ไม่ผูก —" }, ...assistants.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))]} value={assistantCode} onChange={setCode} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: NAPublicUser; onClose: () => void }) {
  const { mutate } = useNAData();
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`ตั้งรหัสผ่านใหม่ — ${user.username}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={pw.length < 6}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              if (await mutate(() => api(`/api/na/users/${encodeURIComponent(user.username)}/password`, { body: { password: pw } }), "ตั้งรหัสผ่านใหม่แล้ว")) onClose();
              setSaving(false);
            }}
          >
            บันทึก
          </Button>
        </>
      }
    >
      <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 6 ตัวอักษร">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </Field>
    </Dialog>
  );
}
