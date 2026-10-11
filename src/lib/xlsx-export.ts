import "server-only";
import ExcelJS from "exceljs";

// Shared workbook-building helpers for the four report exports
// (requirement E) — one place for the "real .xlsx, not a CSV renamed"
// requirement, consistent column/currency/date formatting, and the
// report-generation-date footer, so each export route only has to
// supply its own column list and rows.

export type ExportColumn<T> = {
  header: string;
  key: keyof T;
  width?: number;
  format?: "currency" | "date" | "datetime" | "text";
};

export function addReportSheet<T extends Record<string, unknown>>(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
): void {
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: String(column.key),
    width: column.width ?? 20,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };

  for (const row of rows) {
    // Excel's date numFmt only renders correctly against an actual Date
    // value, not an ISO string — every date/datetime column gets
    // converted here before the row is added, so callers can keep
    // passing the plain ISO strings their report rows already use.
    const converted: Record<string, unknown> = { ...row };
    for (const column of columns) {
      if (column.format === "date" || column.format === "datetime") {
        const raw = converted[String(column.key)];
        if (typeof raw === "string" && raw) {
          converted[String(column.key)] = new Date(raw);
        }
      }
    }

    const added = sheet.addRow(converted);
    for (const column of columns) {
      if (column.format === "currency" || column.format === "date" || column.format === "datetime") {
        const cell = added.getCell(String(column.key));
        if (column.format === "currency") {
          cell.numFmt = '"₹"#,##0.00';
        } else if (column.format === "date") {
          cell.numFmt = "dd-mmm-yyyy";
        } else {
          cell.numFmt = "dd-mmm-yyyy hh:mm";
        }
      }
    }
  }
}

// A small leading sheet every export gets, stating what the file is and
// when it was generated (requirement E: "include... a report-generation
// date") and which filters produced it — so a downloaded file is still
// self-explanatory months later, detached from the admin UI it came from.
export function addGeneratedAtSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  filters: { start: string; end: string; status: string | null },
): void {
  const sheet = workbook.addWorksheet("Report Info", { properties: { tabColor: { argb: "FF15803D" } } });
  sheet.columns = [{ width: 24 }, { width: 40 }];
  sheet.addRow(["Report", title]);
  sheet.addRow(["Date range", `${filters.start} to ${filters.end}`]);
  sheet.addRow(["Status filter", filters.status ?? "All statuses"]);
  sheet.addRow(["Payment method", "Cash on Delivery (only method supported)"]);
  sheet.addRow(["Generated at", new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })]);
  sheet.getColumn(1).font = { bold: true };
}

export function xlsxHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}
