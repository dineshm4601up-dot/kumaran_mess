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

export type DashboardStats = {
  todaysOrderCount: number;
  todaysSales: number;
  activeOrderCount: number;
  deliveredTodayCount: number;
  cancelledTodayCount: number;
};
