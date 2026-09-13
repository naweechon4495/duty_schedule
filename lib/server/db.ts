import { env } from "cloudflare:workers";

/** D1 binding ของ Worker (ตั้งค่าใน wrangler.jsonc → d1_databases.binding = "DB") */
export function db(): D1Database {
  return env.DB;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** แปลง JSON TEXT จากฐานข้อมูลกลับเป็นค่า — ถ้าข้อมูลเสียให้ใช้ค่า fallback แทน */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
