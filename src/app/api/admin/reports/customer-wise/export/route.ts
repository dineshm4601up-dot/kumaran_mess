import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { parseReportQueryParams } from "@/lib/report-dates";
import { getCustomerWiseReport } from "@/lib/reports";
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

  const rows = await getCustomerWiseReport(params.start, params.end, params.status);

  const workbook = new ExcelJS.Workbook();
  addGeneratedAtSheet(workbook, "Customer-wise Sales Report", params);
  addReportSheet(
    workbook,
    "Customer-wise",
    [
      { header: "Customer name", key: "customerName", width: 24 },
      { header: "Phone", key: "customerPhone", width: 16 },
      { header: "Orders", key: "orderCount" },
      { header: "Delivered", key: "deliveredCount" },
      { header: "Cancelled", key: "cancelledCount" },
      { header: "Delivered sales", key: "deliveredSales", format: "currency" },
      { header: "Avg. delivered order value", key: "avgDeliveredOrderValue", format: "currency" },
      { header: "Last order", key: "lastOrderAt", format: "datetime", width: 20 },
    ],
    rows,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as unknown as BodyInit, { headers: xlsxHeaders("customer_wise_sales.xlsx") });
}
