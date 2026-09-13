import { db } from "./db";

/** INSERT หลายแถวในคำสั่งเดียวผ่าน json_each — ใช้กับการนำเข้า/ย้ายข้อมูลจำนวนมาก */
export function insertJsonRows(table: string, cols: string[], rows: unknown[][]): D1PreparedStatement | null {
  if (!rows.length) return null;
  const select = cols.map((_, i) => `json_extract(value, '$[${i}]')`).join(", ");
  return db()
    .prepare(`INSERT INTO ${table} (${cols.join(", ")}) SELECT ${select} FROM json_each(?)`)
    .bind(JSON.stringify(rows));
}
