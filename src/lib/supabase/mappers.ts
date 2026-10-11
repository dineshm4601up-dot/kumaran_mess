import type {
  AdminCustomerListItem,
  AdminOrderDetail,
  AdminOrderListItem,
  Category,
  CustomerAddress,
  CustomerOrderDetail,
  CustomerOrderListItem,
  CustomerWiseReportRow,
  DashboardStats,
  OrderDetailsReportRow,
  OrderLineItem,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  Product,
  ProductWiseReportRow,
  ReportSummary,
  SalesTrendPoint,
  ShopSettings,
} from "@/types";

// Postgres rows are snake_case; the app's types are camelCase. These are
// the one place that boundary gets crossed, so a renamed/added DB column
// only ever needs updating here.

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_path: string | null;
  category_id: string;
  is_available: boolean;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  stock_quantity: number;
};

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    // numeric columns can come back as strings over PostgREST
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
    imagePath: row.image_path,
    categoryId: row.category_id,
    isAvailable: row.is_available,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    displayOrder: row.display_order,
    stock: row.stock_quantity,
  };
}

export type CustomerAddressRow = {
  id: string;
  address_line: string;
  landmark: string | null;
  delivery_instructions: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  is_default: boolean;
};

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

export function mapAddressRow(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    addressLine: row.address_line,
    landmark: row.landmark,
    deliveryInstructions: row.delivery_instructions,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    isDefault: row.is_default,
  };
}

export type ShopSettingsRow = {
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  whatsapp_number: string | null;
  gstin: string | null;
  tax_rate_percent: number | string | null;
  estimated_delivery_minutes: number | null;
  delivery_fee: number | string;
  min_order_amount: number | string;
  service_radius_km: number | string | null;
  base_latitude: number | string | null;
  base_longitude: number | string | null;
  customer_cancellable_statuses: string[];
};

export function mapShopSettingsRow(row: ShopSettingsRow): ShopSettings {
  return {
    shopName: row.shop_name,
    shopAddress: row.shop_address,
    shopPhone: row.shop_phone,
    whatsappNumber: row.whatsapp_number,
    gstin: row.gstin,
    taxRatePercent: toNumberOrNull(row.tax_rate_percent),
    estimatedDeliveryMinutes: row.estimated_delivery_minutes,
    deliveryFee: toNumberOrNull(row.delivery_fee) ?? 0,
    minOrderAmount: toNumberOrNull(row.min_order_amount) ?? 0,
    serviceRadiusKm: toNumberOrNull(row.service_radius_km),
    baseLatitude: toNumberOrNull(row.base_latitude),
    baseLongitude: toNumberOrNull(row.base_longitude),
    customerCancellableStatuses: (row.customer_cancellable_statuses ?? []) as OrderStatus[],
  };
}

export type OrderListRow = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at: string;
};

export function mapOrderListRow(row: OrderListRow): CustomerOrderListItem {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    total: toNumberOrNull(row.total) ?? 0,
    createdAt: row.created_at,
  };
}

export type OrderDetailRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  delivery_address_line: string;
  delivery_landmark: string | null;
  delivery_instructions: string | null;
  cancelled_reason: string | null;
  created_at: string;
};

export type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name_snapshot: string;
  product_price_snapshot: number | string;
  quantity: number;
  line_total: number | string;
};

export type OrderStatusHistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
};

export function mapOrderItemRow(row: OrderItemRow): OrderLineItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    price: toNumberOrNull(row.product_price_snapshot) ?? 0,
    quantity: row.quantity,
    lineTotal: toNumberOrNull(row.line_total) ?? 0,
  };
}

export function mapOrderStatusHistoryRow(row: OrderStatusHistoryRow): OrderStatusEvent {
  return {
    id: row.id,
    fromStatus: row.from_status as OrderStatus | null,
    toStatus: row.to_status as OrderStatus,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapOrderDetail(
  order: OrderDetailRow,
  items: OrderItemRow[],
  history: OrderStatusHistoryRow[],
): CustomerOrderDetail {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status as OrderStatus,
    paymentMethod: "cod",
    paymentStatus: order.payment_status as PaymentStatus,
    subtotal: toNumberOrNull(order.subtotal) ?? 0,
    deliveryFee: toNumberOrNull(order.delivery_fee) ?? 0,
    total: toNumberOrNull(order.total) ?? 0,
    deliveryAddressLine: order.delivery_address_line,
    deliveryLandmark: order.delivery_landmark,
    deliveryInstructions: order.delivery_instructions,
    cancelledReason: order.cancelled_reason,
    createdAt: order.created_at,
    items: items.map(mapOrderItemRow),
    statusHistory: history.map(mapOrderStatusHistoryRow),
  };
}

// --- Admin-only shapes (search results, full detail with customer info
// and staff attribution, dashboard aggregates) ---------------------------

export type AdminOrderSearchRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number | string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
};

export function mapAdminOrderSearchRow(row: AdminOrderSearchRow): AdminOrderListItem {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    total: toNumberOrNull(row.total) ?? 0,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  };
}

export type AdminOrderDetailRow = OrderDetailRow & {
  customer_id: string;
  delivery_latitude: number | string | null;
  delivery_longitude: number | string | null;
  payment_updated_at: string | null;
};

export function mapAdminOrderDetail(
  order: AdminOrderDetailRow,
  customer: { full_name: string; phone: string },
  items: OrderItemRow[],
  history: (OrderStatusHistoryRow & { staff_name: string | null })[],
  paymentUpdatedByName: string | null,
): AdminOrderDetail {
  const base = mapOrderDetail(order, items, history);
  return {
    ...base,
    customerName: customer.full_name,
    customerPhone: customer.phone,
    deliveryLatitude: toNumberOrNull(order.delivery_latitude),
    deliveryLongitude: toNumberOrNull(order.delivery_longitude),
    paymentUpdatedAt: order.payment_updated_at,
    paymentUpdatedByName,
    statusHistory: history.map((row) => ({
      ...mapOrderStatusHistoryRow(row),
      staffName: row.staff_name,
    })),
  };
}

export type DashboardStatsRow = {
  todays_order_count: number | string;
  todays_sales: number | string;
  active_order_count: number | string;
  delivered_today_count: number | string;
  cancelled_today_count: number | string;
};

export function mapDashboardStatsRow(row: DashboardStatsRow): DashboardStats {
  return {
    todaysOrderCount: Number(row.todays_order_count),
    todaysSales: toNumberOrNull(row.todays_sales) ?? 0,
    activeOrderCount: Number(row.active_order_count),
    deliveredTodayCount: Number(row.delivered_today_count),
    cancelledTodayCount: Number(row.cancelled_today_count),
  };
}

// --- Phase 12: admin reports & customer management -------------------

export type AdminCustomerListRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  created_at: string;
  order_count: number | string;
  delivered_sales: number | string;
};

export function mapAdminCustomerListRow(row: AdminCustomerListRow): AdminCustomerListItem {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
    orderCount: Number(row.order_count),
    deliveredSales: toNumberOrNull(row.delivered_sales) ?? 0,
  };
}

export type ReportSummaryRow = {
  total_orders: number | string;
  delivered_orders: number | string;
  cancelled_orders: number | string;
  pending_processing_orders: number | string;
  delivered_sales: number | string;
  total_delivery_charges: number | string;
  cod_collected: number | string;
  cod_pending: number | string;
  avg_delivered_order_value: number | string;
};

export function mapReportSummaryRow(row: ReportSummaryRow): ReportSummary {
  return {
    totalOrders: Number(row.total_orders),
    deliveredOrders: Number(row.delivered_orders),
    cancelledOrders: Number(row.cancelled_orders),
    pendingProcessingOrders: Number(row.pending_processing_orders),
    deliveredSales: toNumberOrNull(row.delivered_sales) ?? 0,
    totalDeliveryCharges: toNumberOrNull(row.total_delivery_charges) ?? 0,
    codCollected: toNumberOrNull(row.cod_collected) ?? 0,
    codPending: toNumberOrNull(row.cod_pending) ?? 0,
    avgDeliveredOrderValue: toNumberOrNull(row.avg_delivered_order_value) ?? 0,
  };
}

export type SalesTrendRow = {
  trend_date: string;
  order_count: number | string;
  delivered_sales: number | string;
};

export function mapSalesTrendRow(row: SalesTrendRow): SalesTrendPoint {
  return {
    date: row.trend_date,
    orderCount: Number(row.order_count),
    deliveredSales: toNumberOrNull(row.delivered_sales) ?? 0,
  };
}

export type CustomerWiseReportRowDb = {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  order_count: number | string;
  delivered_count: number | string;
  cancelled_count: number | string;
  delivered_sales: number | string;
  avg_delivered_order_value: number | string;
  last_order_at: string | null;
};

export function mapCustomerWiseReportRow(row: CustomerWiseReportRowDb): CustomerWiseReportRow {
  return {
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    orderCount: Number(row.order_count),
    deliveredCount: Number(row.delivered_count),
    cancelledCount: Number(row.cancelled_count),
    deliveredSales: toNumberOrNull(row.delivered_sales) ?? 0,
    avgDeliveredOrderValue: toNumberOrNull(row.avg_delivered_order_value) ?? 0,
    lastOrderAt: row.last_order_at,
  };
}

export type ProductWiseReportRowDb = {
  product_name: string;
  quantity_sold: number | string;
  order_count: number | string;
  total_sales: number | string;
};

export function mapProductWiseReportRow(row: ProductWiseReportRowDb): ProductWiseReportRow {
  return {
    productName: row.product_name,
    quantitySold: Number(row.quantity_sold),
    orderCount: Number(row.order_count),
    totalSales: toNumberOrNull(row.total_sales) ?? 0,
  };
}

export type OrderDetailsReportRowDb = {
  order_id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  items_summary: string | null;
  subtotal: number | string;
  delivery_fee: number | string;
  tax_amount: number | string;
  total: number | string;
  status: string;
  payment_status: string;
  payment_updated_at: string | null;
};

export function mapOrderDetailsReportRow(row: OrderDetailsReportRowDb): OrderDetailsReportRow {
  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    itemsSummary: row.items_summary,
    subtotal: toNumberOrNull(row.subtotal) ?? 0,
    deliveryFee: toNumberOrNull(row.delivery_fee) ?? 0,
    taxAmount: toNumberOrNull(row.tax_amount) ?? 0,
    total: toNumberOrNull(row.total) ?? 0,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentUpdatedAt: row.payment_updated_at,
  };
}
