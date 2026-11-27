/* Browser-side Excel/CSV helpers for goals. Excel needs the SheetJS reader once (online), then the browser caches it; CSV always works offline. */
import { parseCSV } from "../domain/vault";
import { goalExportRows, goalCsv, parseGoalSheets, buildGoalImport } from "../domain/goalOps";
import { todayStr } from "../domain/clock";
import { setUi, toast } from "./uiStore";

const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
let xp: Promise<any> | null = null;
export function loadXlsx(): Promise<any> {
  const w: any = window; if (w.XLSX) return Promise.resolve(w.XLSX);
  if (!xp) xp = new Promise((res, rej) => { const s = document.createElement("script"); s.src = XLSX_URL; s.onload = () => res(w.XLSX); s.onerror = () => { xp = null; rej(new Error("offline")); }; document.head.appendChild(s); });
  return xp;
}
export function download(name: string, data: BlobPart, type: string) {
  const u = URL.createObjectURL(new Blob([data], { type })), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
}
export function exportGoalsCsv() { download(`goals-${todayStr()}.csv`, "﻿" + goalCsv(), "text/csv"); toast("CSV saved"); }
export async function exportGoalsXlsx() {
  try { const X = await loadXlsx(), { head, rows } = goalExportRows(), ws = X.utils.aoa_to_sheet([head, ...rows]), wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Goals"); X.writeFile(wb, `goals-${todayStr()}.xlsx`); toast("Excel file saved"); }
  catch { exportGoalsCsv(); toast("Excel reader needs internet once — saved as CSV instead"); }
}
/** Pick a file and open the review sheet. Handles .csv offline and .xlsx when the reader can load. */
export function pickGoalFile() {
  const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv,text/csv"; i.setAttribute("data-testid", "goal-file");
  i.onchange = async () => {
    const f = i.files && i.files[0]; if (!f) return;
    try {
      let sheets: any[][][];
      if (/\.csv$/i.test(f.name)) sheets = [parseCSV(await f.text())];
      else { const X = await loadXlsx(), wb = X.read(await f.arrayBuffer(), { type: "array" }); sheets = wb.SheetNames.map((n: string) => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" })); }
      const rows = parseGoalSheets(sheets); if (!rows.length) return toast("No goal rows found. Needs a “Goal Name” and “Goal Total” column.");
      setUi({ importItems: buildGoalImport(rows), sheet: "gimport", sheetArg: null });
    } catch { toast(/\.csv$/i.test(f.name) ? "Couldn't read that file" : "Excel reader needs internet once. Save the sheet as CSV to import offline."); }
  };
  i.click();
}

/* ---- shared by To-do and Vault: workbook read/write with a CSV fallback ---- */
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export async function readWorkbook(f: File): Promise<any[][][]> { const X = await loadXlsx(), wb = X.read(await f.arrayBuffer(), { type: "array" }); return wb.SheetNames.map((n: string) => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })); }
export async function writeWorkbook(name: string, sheets: { name: string; rows: any[][] }[], csvRows: any[][], onOk: () => void, csvOnly = false) {
  try { if (csvOnly) throw new Error("csv"); const X = await loadXlsx(), wb = X.utils.book_new(); sheets.forEach((s) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(s.rows), s.name)); download(name + ".xlsx", X.write(wb, { bookType: "xlsx", type: "array" }), XLSX_MIME); onOk(); }
  catch { const q = (v: any) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; download(name + ".csv", "﻿" + csvRows.map((r) => r.map(q).join(",")).join("\n"), "text/csv"); toast(csvOnly ? "CSV saved" : "Couldn't load the Excel writer, so I saved a CSV instead"); }
}
