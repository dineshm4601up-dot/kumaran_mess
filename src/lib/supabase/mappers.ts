import type {
  AdminOrderDetail,
  AdminOrderListItem,
  Category,
  CustomerAddress,
  CustomerOrderDetail,
  CustomerOrderListItem,
  DashboardStats,
  OrderLineItem,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  Product,
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
  delivery_fee: number | string;
  min_order_amount: number | string;
  service_radius_km: number | string | null;
  base_latitude: number | string | null;
  base_longitude: number | string | null;
  customer_cancellable_statuses: string[];
};

export function mapShopSettingsRow(row: ShopSettingsRow): ShopSettings {
  return {
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
