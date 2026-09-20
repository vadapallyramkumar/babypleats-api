import type { Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

export type OrderWithItems = Order & { items: OrderItem[] };

export type RazorpayPayload = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
};

export function mapOrder(
  order: OrderWithItems,
  razorpay?: RazorpayPayload,
) {
  return {
    id: order.id,
    status: order.status,
    source: order.source,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      sku: item.sku ?? undefined,
      size: item.size ?? undefined,
      color: item.color ?? undefined,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
    totals: {
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
    },
    coupon: order.couponCode
      ? { code: order.couponCode, discount: order.discount }
      : undefined,
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      razorpayOrderId: order.razorpayOrderId ?? undefined,
      razorpayPaymentId: order.razorpayPaymentId ?? undefined,
    },
    notes: order.notes ?? undefined,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    ...(razorpay ? { razorpay } : {}),
  };
}

export type MappedOrder = ReturnType<typeof mapOrder>;

export type DashboardRecentOrder = {
  id: string;
  customerName: string;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
};

export type DashboardTopProduct = {
  productId: string;
  productName: string;
  qty: number;
  revenue: number;
};
