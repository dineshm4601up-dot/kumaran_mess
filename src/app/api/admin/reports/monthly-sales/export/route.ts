import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { parseReportQueryParams } from "@/lib/report-dates";
import { getReportSummary, getSalesTrend } from "@/lib/reports";
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

  // Full matching data, not whatever the admin currently has on screen
  // (requirement E: "export all matching records") — same RPCs the page
  // itself uses, called fresh here rather than reusing any client state.
  const [summary, trend] = await Promise.all([
    getReportSummary(params.start, params.end, params.status),
    getSalesTrend(params.start, params.end, params.status),
  ]);

  const workbook = new ExcelJS.Workbook();
  addGeneratedAtSheet(workbook, "Monthly Sales Report", params);

  addReportSheet(
    workbook,
    "Summary",
    [
      { header: "Total orders", key: "totalOrders" },
      { header: "Delivered orders", key: "deliveredOrders" },
      { header: "Cancelled orders", key: "cancelledOrders" },
      { header: "Pending / processing orders", key: "pendingProcessingOrders" },
      { header: "Delivered sales", key: "deliveredSales", format: "currency" },
      { header: "Total delivery charges", key: "totalDeliveryCharges", format: "currency" },
      { header: "COD collected", key: "codCollected", format: "currency" },
      { header: "COD pending collection", key: "codPending", format: "currency" },
      { header: "Avg. delivered order value", key: "avgDeliveredOrderValue", format: "currency" },
    ],
    [summary],
  );

  addReportSheet(
    workbook,
    "Daily Trend",
    [
      { header: "Date", key: "date" },
      { header: "Orders", key: "orderCount" },
      { header: "Delivered sales", key: "deliveredSales", format: "currency" },
    ],
    trend,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `monthly_sales_${params.end.slice(0, 7)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, { headers: xlsxHeaders(filename) });
}
