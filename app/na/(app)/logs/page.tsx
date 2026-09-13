"use client";

import { LogViewer } from "@/components/logs/log-viewer";
import { RequireNAAdmin } from "@/components/shell/na-shell";
import { PageHeader } from "@/components/ui/card";

export default function NALogsPage() {
  return (
    <RequireNAAdmin>
      <PageHeader title="Log การใช้งาน NA" description="ใครทำอะไร แก้อะไร เมื่อไหร่" />
      <LogViewer endpoint="/api/na/logs" />
    </RequireNAAdmin>
  );
}
