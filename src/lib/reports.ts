import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  mapCustomerWiseReportRow,
  mapOrderDetailsReportRow,
  mapProductWiseReportRow,
  mapReportSummaryRow,
  mapSalesTrendRow,
  type CustomerWiseReportRowDb,
  type OrderDetailsReportRowDb,
  type ProductWiseReportRowDb,
  type ReportSummaryRow,
  type SalesTrendRow,
} from "@/lib/supabase/mappers";
import type {
  CustomerWiseReportRow,
  OrderDetailsReportRow,
  OrderStatus,
  ProductWiseReportRow,
  ReportSummary,
  SalesTrendPoint,
} from "@/types";

const EMPTY_SUMMARY: ReportSummary = {
  totalOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  pendingProcessingOrders: 0,
  deliveredSales: 0,
  totalDeliveryCharges: 0,
  codCollected: 0,
  codPending: 0,
  avgDeliveredOrderValue: 0,
};

// Every function here is a single RPC call wrapping one of the
// aggregate queries in 20260101000023_admin_reports.sql — there is no
// per-row/per-customer/per-product looping anywhere in this file
// (requirement 9). All take the same (start, end, status) shape so the
// admin Reports page can call whichever one the active tab needs
// without re-deriving the date range per report.

export async function getReportSummary(
  start: string,
  end: string,
  status: OrderStatus | null,
): Promise<ReportSummary> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("admin_report_summary", { p_start: start, p_end: end, p_status: status })
    .single();

  if (error || !data) {
    if (error) console.error("admin_report_summary:", error);
    return EMPTY_SUMMARY;
  }

  return mapReportSummaryRow(data as ReportSummaryRow);
}

export async function getSalesTrend(
  start: string,
  end: string,
  status: OrderStatus | null,
): Promise<SalesTrendPoint[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_report_sales_trend", {
    p_start: start,
    p_end: end,
    p_status: status,
  });

  if (error) {
    console.error("admin_report_sales_trend:", error);
    return [];
  }

  return ((data ?? []) as SalesTrendRow[]).map(mapSalesTrendRow);
}

export async function getCustomerWiseReport(
  start: string,
  end: string,
  status: OrderStatus | null,
): Promise<CustomerWiseReportRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_report_customer_wise", {
    p_start: start,
    p_end: end,
    p_status: status,
  });

  if (error) {
    console.error("admin_report_customer_wise:", error);
    return [];
  }

  return ((data ?? []) as CustomerWiseReportRowDb[]).map(mapCustomerWiseReportRow);
}

export async function getProductWiseReport(
  start: string,
  end: string,
  status: OrderStatus | null,
): Promise<ProductWiseReportRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_report_product_wise", {
    p_start: start,
    p_end: end,
    p_status: status,
  });

  if (error) {
    console.error("admin_report_product_wise:", error);
    return [];
  }

  return ((data ?? []) as ProductWiseReportRowDb[]).map(mapProductWiseReportRow);
}

export async function getOrderDetailsReport(
  start: string,
  end: string,
  status: OrderStatus | null,
): Promise<OrderDetailsReportRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_report_order_details", {
    p_start: start,
    p_end: end,
    p_status: status,
  });

  if (error) {
    console.error("admin_report_order_details:", error);
    return [];
  }

  return ((data ?? []) as OrderDetailsReportRowDb[]).map(mapOrderDetailsReportRow);
}
