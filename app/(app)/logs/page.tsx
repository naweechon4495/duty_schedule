"use client";

import { LogViewer } from "@/components/logs/log-viewer";
import { RequirePage } from "@/components/shell/nurse-shell";
import { PageHeader } from "@/components/ui/card";

export default function LogsPage() {
  return (
    <RequirePage page="logs">
      <PageHeader title="Log การใช้งาน" description="ใครทำอะไร แก้อะไร เมื่อไหร่ — กดที่รายการเพื่อดูค่าก่อน/หลังแก้" />
      <LogViewer endpoint="/api/logs" />
    </RequirePage>
  );
}
