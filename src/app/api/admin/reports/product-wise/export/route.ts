import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { parseReportQueryParams } from "@/lib/report-dates";
import { getProductWiseReport } from "@/lib/reports";
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

  const rows = await getProductWiseReport(params.start, params.end, params.status);

  const workbook = new ExcelJS.Workbook();
  addGeneratedAtSheet(workbook, "Product-wise Sales Report", params);
  addReportSheet(
    workbook,
    "Product-wise",
    [
      { header: "Product", key: "productName", width: 28 },
      { header: "Quantity sold", key: "quantitySold" },
      { header: "Orders containing it", key: "orderCount" },
      { header: "Total sales", key: "totalSales", format: "currency" },
    ],
    rows,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as unknown as BodyInit, { headers: xlsxHeaders("product_wise_sales.xlsx") });
}
