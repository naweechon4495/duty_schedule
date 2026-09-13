"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** เรียก API ของระบบ — error มีข้อความไทยพร้อมแสดงผู้ใช้; ถ้า session หมดอายุพากลับหน้า login */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown; loginPath?: string }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method || (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  }
  let data: { error?: string } & Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* ไม่มี body */
  }
  if (res.status === 401 && init?.loginPath !== undefined) {
    window.location.href = init.loginPath;
  }
  if (!res.ok) throw new ApiError(res.status, data.error || "เกิดข้อผิดพลาด (" + res.status + ")");
  return data as T;
}
