import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { parseReportQueryParams } from "@/lib/report-dates";
import { getOrderDetailsReport } from "@/lib/reports";
import { addGeneratedAtSheet, addReportSheet, xlsxHeaders } from "@/lib/xlsx-export";

export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = parseReportQueryParams(new URL(request.url).searchParams);
  if (!params) {
    return NextResponse.json({ error: "invalid_date_range" }, { status: 400 });
  }

  const rows = await getOrderDetailsReport(params.start, params.end, params.status);

  // "Collected amount"/"collection date" (requirement D) aren't separate
  // stored columns — this app has no partial-COD-collection concept, so
  // the collected amount is always exactly `total` once payment_status
  // is 'collected', and the collection date is payment_updated_at at
  // that point. Derived here rather than adding redundant DB columns.
  const rowsWithCollection = rows.map((row) => ({
    ...row,
    collectedAmount: row.paymentStatus === "collected" ? row.total : null,
    collectionDate: row.paymentStatus === "collected" ? row.paymentUpdatedAt : null,
  }));

  const workbook = new ExcelJS.Workbook();
  addGeneratedAtSheet(workbook, "Order Details Report", params);
  addReportSheet(
    workbook,
    "Order Details",
    [
      { header: "Order #", key: "orderNumber", width: 18 },
      { header: "Order date", key: "createdAt", format: "datetime", width: 20 },
      { header: "Customer name", key: "customerName", width: 22 },
      { header: "Customer phone", key: "customerPhone", width: 16 },
      { header: "Items", key: "itemsSummary", width: 36 },
      { header: "Subtotal", key: "subtotal", format: "currency" },
      { header: "Delivery fee", key: "deliveryFee", format: "currency" },
      { header: "Tax", key: "taxAmount", format: "currency" },
      { header: "Total", key: "total", format: "currency" },
      { header: "Status", key: "status", width: 16 },
      { header: "COD status", key: "paymentStatus", width: 14 },
      { header: "Collected amount", key: "collectedAmount", format: "currency" },
      { header: "Collection date", key: "collectionDate", format: "datetime", width: 20 },
    ],
    rowsWithCollection,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `order_details_${params.start}_to_${params.end}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, { headers: xlsxHeaders(filename) });
}
