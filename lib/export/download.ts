"use client";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** โหลด ExcelJS เฉพาะตอนกด export (ไม่เพิ่มขนาดหน้าเว็บตอนเปิด) */
export async function loadExcelJS() {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof import("exceljs") }).default ?? mod;
}

export async function saveWorkbook(wb: import("exceljs").Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F766E" } };
export const thinBorder = {
  top: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
  left: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
  right: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
};
