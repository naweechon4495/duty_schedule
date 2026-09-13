/** ข้อผิดพลาดที่ตั้งใจส่งกลับให้หน้าเว็บ (ข้อความภาษาไทยแสดงผู้ใช้ได้เลย) */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = "ไม่พบข้อมูล") => new HttpError(404, msg);

export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * ครอบ route handler: แปลง HttpError เป็น JSON, กัน request ข้ามโดเมนสำหรับการแก้ข้อมูล
 * และไม่ให้ error ภายในหลุดรายละเอียดไปถึงผู้ใช้
 */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
      console.error("API error", req.method, new URL(req.url).pathname, err);
      return json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" }, { status: 500 });
    }
  };
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (!origin) return; // fetch จากหน้าเดียวกันบางเบราว์เซอร์ไม่ส่ง Origin — cookie SameSite=Lax กันอยู่แล้ว
  if (new URL(origin).host !== new URL(req.url).host) throw new HttpError(403, "ไม่อนุญาตคำขอจากเว็บไซต์อื่น");
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest("ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }
}

export function str(v: unknown, max = 500): string {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max);
}

export function isDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

export function newId(prefix: string): string {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 6);
}
