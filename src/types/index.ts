export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imagePath: string | null;
  categoryId: string;
  isAvailable: boolean;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  stock: number;
};

export type CustomerAddress = {
  id: string;
  addressLine: string;
  landmark: string | null;
  deliveryInstructions: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
};

export type ShopSettings = {
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  whatsappNumber: string | null;
  gstin: string | null;
  taxRatePercent: number | null;
  estimatedDeliveryMinutes: number | null;
  deliveryFee: number;
  minOrderAmount: number;
  serviceRadiusKm: number | null;
  baseLatitude: number | null;
  baseLongitude: number | null;
  customerCancellableStatuses: OrderStatus[];
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "collected" | "refused";

export type OrderSummary = {
  id: string;
  orderNumber: string;
  customerName: string;
  placedAt: string;
  total: number;
  status: OrderStatus;
  paymentMethod: "cod";
};

export type CustomerOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
};

export type OrderLineItem = {
  id: string;
  productId: string | null;
  productName: string;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type OrderStatusEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type CustomerOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "cod";
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddressLine: string;
  deliveryLandmark: string | null;
  deliveryInstructions: string | null;
  cancelledReason: string | null;
  createdAt: string;
  items: OrderLineItem[];
  statusHistory: OrderStatusEvent[];
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
};

export type AdminOrderStatusEvent = OrderStatusEvent & {
  staffName: string | null;
};

export type AdminOrderDetail = Omit<CustomerOrderDetail, "statusHistory"> & {
  customerName: string;
  customerPhone: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  paymentUpdatedAt: string | null;
  paymentUpdatedByName: string | null;
  statusHistory: AdminOrderStatusEvent[];
};

// A bill is its own purpose-built shape, not a reuse of
// CustomerOrderDetail/AdminOrderDetail — those two serve the order
// *tracking* pages (Phase 6/7) and already differ from each other
// (customer's own view vs. staff's). The bill is one single layout
// shared by both (requirement B: "use a shared reusable bill component
// for both customer and admin views"), so it's simplest as its own type
// that both sides' queries fill in identically, via src/lib/bills.ts.
export type BillData = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  cancelledReason: string | null;
  isTaxInvoice: boolean; // true only when both gstin and a tax amount > 0 are present on this order
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  gstin: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddressLine: string;
  deliveryLandmark: string | null;
  deliveryInstructions: string | null;
  items: OrderLineItem[];
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  taxRatePercent: number | null;
  total: number;
  paymentMethod: "cod";
  paymentStatus: PaymentStatus;
};

export type DashboardStats = {
  todaysOrderCount: number;
  todaysSales: number;
  activeOrderCount: number;
  deliveredTodayCount: number;
  cancelledTodayCount: number;
};

// --- Phase 12: admin reports & customer management ------------------

export type AdminCustomerListItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  createdAt: string;
  orderCount: number;
  deliveredSales: number;
};

export type AdminCustomerDetail = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  createdAt: string;
  pinResetRequired: boolean;
  addresses: CustomerAddress[];
  orders: AdminOrderListItem[];
};

export type ReportDateRangePreset = "this_month" | "last_month" | "this_year" | "custom";

export type ReportFilters = {
  preset: ReportDateRangePreset;
  start: string; // yyyy-mm-dd, resolved (Asia/Kolkata calendar day)
  end: string; // yyyy-mm-dd, resolved (Asia/Kolkata calendar day)
  status: OrderStatus | null;
};

export type ReportSummary = {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingProcessingOrders: number;
  deliveredSales: number;
  totalDeliveryCharges: number;
  codCollected: number;
  codPending: number;
  avgDeliveredOrderValue: number;
};

export type SalesTrendPoint = {
  date: string;
  orderCount: number;
  deliveredSales: number;
};

export type CustomerWiseReportRow = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  deliveredSales: number;
  avgDeliveredOrderValue: number;
  lastOrderAt: string | null;
};

export type ProductWiseReportRow = {
  productName: string;
  quantitySold: number;
  orderCount: number;
  totalSales: number;
};

export type OrderDetailsReportRow = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  itemsSummary: string | null;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentUpdatedAt: string | null;
};
