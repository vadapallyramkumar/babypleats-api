import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type { ApiVariant } from '../common/mappers';
import { CouponsService } from '../coupons/coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CheckoutDto } from './dto/checkout.dto';
import type { UpdateOrderDto } from './dto/update-order.dto';
import type { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  DASHBOARD_RECENT_LIMIT,
  LOW_STOCK_THRESHOLD,
  ORDER_ADVISORY_LOCK,
  ORDER_ID_PREFIX,
  ORDER_SEQ_START,
  SALES_RANGES,
  type SalesRange,
} from './orders.constants';
import {
  mapOrder,
  type DashboardRecentOrder,
  type DashboardTopProduct,
} from './orders.mappers';
import { RazorpayService } from './razorpay.service';
import { computeShipping, roundMoney } from './shipping';
import { linesSubtotal, snapshotCartItems } from './snapshot-items';
import { applyStockDelta } from './stock';

const INCLUDE_ITEMS = { items: true } as const;

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: [OrderStatus.cancelled],
  new: [OrderStatus.confirmed, OrderStatus.cancelled],
  confirmed: [OrderStatus.shipped, OrderStatus.cancelled],
  shipped: [OrderStatus.delivered, OrderStatus.cancelled],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly coupons: CouponsService,
  ) {}

  async checkout(body: CheckoutDto) {
    const lines = await snapshotCartItems(this.prisma, body.items);
    const subtotal = linesSubtotal(lines);
    const shipping = computeShipping(subtotal);
    const customer = body.customer;
    const notes = body.notes?.trim() || null;
    const applyStockNow = body.paymentMethod === 'cod';
    const couponCode = body.couponCode?.trim();

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${ORDER_ADVISORY_LOCK})`,
      );
      const agg = await tx.order.aggregate({ _max: { seq: true } });
      const seq = (agg._max.seq ?? ORDER_SEQ_START - 1) + 1;
      const id = `${ORDER_ID_PREFIX}${seq}`;

      let discount = 0;
      let couponId: string | null = null;
      let snapshotCode: string | null = null;
      if (couponCode) {
        const applied = await this.coupons.evaluate(
          tx,
          couponCode,
          subtotal,
          customer.phone.trim(),
        );
        discount = applied.discount;
        couponId = applied.coupon.id;
        snapshotCode = applied.coupon.code;
      }

      const total = roundMoney(subtotal - discount + shipping);

      if (applyStockNow) {
        await applyStockDelta(tx, lines, 'decrement');
      }

      const created = await tx.order.create({
        data: {
          id,
          seq,
          status:
            body.paymentMethod === 'cod'
              ? OrderStatus.new
              : OrderStatus.pending_payment,
          source: body.source ?? 'website',
          customerName: customer.name.trim(),
          customerEmail: customer.email.trim().toLowerCase(),
          customerPhone: customer.phone.trim(),
          address: customer.address.trim(),
          city: customer.city.trim(),
          state: customer.state.trim(),
          pincode: customer.pincode.trim(),
          notes,
          paymentMethod: body.paymentMethod,
          paymentStatus: PaymentStatus.pending,
          subtotal,
          shipping,
          discount,
          total,
          currency: 'INR',
          couponId,
          couponCode: snapshotCode,
          stockApplied: applyStockNow,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              sku: line.sku,
              size: line.size,
              color: line.color,
              qty: line.qty,
              unitPrice: line.unitPrice,
            })),
          },
        },
        include: INCLUDE_ITEMS,
      });

      if (applyStockNow && couponId) {
        await this.coupons.recordRedemption(tx, {
          couponId,
          orderId: created.id,
          phone: created.customerPhone,
        });
      }

      return created;
    });

    if (body.paymentMethod === 'cod') {
      return mapOrder(order);
    }

    const total = order.total;

    try {
      const rp = await this.razorpay.createOrder({
        amountPaise: Math.round(total * 100),
        receipt: order.id,
        notes: { orderId: order.id },
      });
      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: rp.id },
        include: INCLUDE_ITEMS,
      });
      return mapOrder(updated, {
        keyId: this.razorpay.keyId(),
        orderId: rp.id,
        amount: rp.amount,
        currency: rp.currency,
      });
    } catch (error) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.cancelled,
          paymentStatus: PaymentStatus.failed,
        },
      });
      throw error;
    }
  }

  async verifyPayment(body: VerifyPaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: body.orderId }, { razorpayOrderId: body.razorpay_order_id }],
      },
      include: INCLUDE_ITEMS,
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.paymentMethod !== PaymentMethod.razorpay) {
      throw new BadRequestException('Order is not an online payment order');
    }

    if (
      order.razorpayOrderId &&
      order.razorpayOrderId !== body.razorpay_order_id
    ) {
      throw new BadRequestException('Razorpay order does not match');
    }

    const valid = this.razorpay.verifySignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );
    if (!valid) {
      throw new BadRequestException('Invalid payment signature');
    }

    if (
      order.paymentStatus === PaymentStatus.paid &&
      order.status !== OrderStatus.pending_payment
    ) {
      return mapOrder(order);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!order.stockApplied) {
        await applyStockDelta(tx, order.items, 'decrement');
      }
      if (order.couponId) {
        await this.coupons.recordRedemption(tx, {
          couponId: order.couponId,
          orderId: order.id,
          phone: order.customerPhone,
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.new,
          paymentStatus: PaymentStatus.paid,
          razorpayOrderId: body.razorpay_order_id,
          razorpayPaymentId: body.razorpay_payment_id,
          stockApplied: true,
        },
        include: INCLUDE_ITEMS,
      });
    });

    return mapOrder(updated);
  }

  async list(query: {
    status?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));
    const where = this.listWhere(query);

    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: INCLUDE_ITEMS,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => mapOrder(row)),
      meta: { page, limit, total },
    };
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: INCLUDE_ITEMS,
    });
    if (!order) throw new NotFoundException('Order not found');
    return mapOrder(order);
  }

  async update(id: string, body: UpdateOrderDto) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: INCLUDE_ITEMS,
    });
    if (!existing) throw new NotFoundException('Order not found');

    if (body.status && body.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(body.status)) {
        throw new BadRequestException(
          `Cannot change status from ${existing.status} to ${body.status}`,
        );
      }
    }

    const nextStatus = body.status ?? existing.status;
    const cancelling =
      nextStatus === OrderStatus.cancelled &&
      existing.status !== OrderStatus.cancelled;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (cancelling && existing.stockApplied) {
        await applyStockDelta(tx, existing.items, 'restore');
      }
      if (cancelling) {
        await this.coupons.releaseRedemption(tx, existing.id);
      }
      return tx.order.update({
        where: { id },
        data: {
          ...(body.status ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes.trim() || null } : {}),
          ...(cancelling && existing.stockApplied ? { stockApplied: false } : {}),
        },
        include: INCLUDE_ITEMS,
      });
    });

    return mapOrder(updated);
  }

  async salesDashboard(rangeInput?: string) {
    const range: SalesRange = SALES_RANGES.includes(rangeInput as SalesRange)
      ? (rangeInput as SalesRange)
      : '30d';
    const from = rangeStart(range);
    const revenueWhere = this.revenueWhere(from);

    const [revenueOrders, recentRows, itemRows, toShip, awaitingPayment, catalog] =
      await Promise.all([
        this.prisma.order.findMany({
          where: revenueWhere,
          select: {
            total: true,
            discount: true,
            paymentMethod: true,
          },
        }),
        this.prisma.order.findMany({
          where: { createdAt: { gte: from } },
          orderBy: { createdAt: 'desc' },
          take: DASHBOARD_RECENT_LIMIT,
          select: {
            id: true,
            customerName: true,
            total: true,
            currency: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
          },
        }),
        this.prisma.orderItem.findMany({
          where: { order: revenueWhere },
          select: {
            productId: true,
            productName: true,
            qty: true,
            unitPrice: true,
          },
        }),
        this.prisma.order.count({
          where: { status: { in: [OrderStatus.new, OrderStatus.confirmed] } },
        }),
        this.prisma.order.count({
          where: { status: OrderStatus.pending_payment },
        }),
        this.catalogSnapshot(),
      ]);

    const revenue = roundMoney(
      revenueOrders.reduce((sum, row) => sum + row.total, 0),
    );
    const discountGiven = roundMoney(
      revenueOrders.reduce((sum, row) => sum + row.discount, 0),
    );
    const ordersCount = revenueOrders.length;
    const averageOrderValue =
      ordersCount === 0 ? 0 : roundMoney(revenue / ordersCount);
    const codCount = revenueOrders.filter(
      (row) => row.paymentMethod === PaymentMethod.cod,
    ).length;
    const razorpayCount = revenueOrders.filter(
      (row) => row.paymentMethod === PaymentMethod.razorpay,
    ).length;

    const recentOrders: DashboardRecentOrder[] = recentRows.map((row) => ({
      id: row.id,
      customerName: row.customerName,
      total: row.total,
      currency: row.currency,
      status: row.status,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      createdAt: row.createdAt.toISOString(),
    }));

    const topMap = new Map<string, DashboardTopProduct>();
    for (const item of itemRows) {
      const current = topMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        qty: 0,
        revenue: 0,
      };
      current.qty += item.qty;
      current.revenue = roundMoney(current.revenue + item.unitPrice * item.qty);
      topMap.set(item.productId, current);
    }
    const topProducts = [...topMap.values()]
      .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
      .slice(0, 5);

    return {
      range,
      from: from.toISOString(),
      revenue,
      discountGiven,
      ordersCount,
      averageOrderValue,
      toShip,
      awaitingPayment,
      codCount,
      razorpayCount,
      recentOrders,
      topProducts,
      productsActive: catalog.productsActive,
      lowStock: catalog.lowStock,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    };
  }

  private revenueWhere(from: Date): Prisma.OrderWhereInput {
    return {
      createdAt: { gte: from },
      status: { notIn: [OrderStatus.pending_payment, OrderStatus.cancelled] },
      OR: [
        { paymentMethod: PaymentMethod.cod },
        {
          paymentMethod: PaymentMethod.razorpay,
          paymentStatus: PaymentStatus.paid,
        },
      ],
    };
  }

  private listWhere(query: {
    status?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    q?: string;
  }): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      if (!isOrderStatus(query.status)) {
        throw new BadRequestException('Invalid status');
      }
      where.status = query.status;
    }

    if (query.paymentMethod) {
      if (!isPaymentMethod(query.paymentMethod)) {
        throw new BadRequestException('Invalid paymentMethod');
      }
      where.paymentMethod = query.paymentMethod;
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      const from = parseIsoDate(query.from, 'from');
      createdAt.gte = from;
    }
    if (query.to) {
      const to = parseIsoDate(query.to, 'to');
      createdAt.lte = to;
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
      ];
    }

    return where;
  }

  private async catalogSnapshot() {
    const products = await this.prisma.product.findMany({
      select: { isActive: true, variants: true },
    });
    let lowStock = 0;
    let productsActive = 0;
    for (const product of products) {
      if (!product.isActive) continue;
      productsActive += 1;
      const variants = parseVariants(product.variants).filter((v) => v.isActive);
      const stock = variants.reduce((sum, v) => sum + v.stock, 0);
      if (stock <= LOW_STOCK_THRESHOLD) lowStock += 1;
    }
    return { productsActive, lowStock };
  }
}

function parseVariants(raw: string): ApiVariant[] {
  try {
    const parsed = JSON.parse(raw) as ApiVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isOrderStatus(value: string): value is OrderStatus {
  return (Object.values(OrderStatus) as string[]).includes(value);
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return (Object.values(PaymentMethod) as string[]).includes(value);
}

function parseIsoDate(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date`);
  }
  return date;
}

function rangeStart(range: SalesRange): Date {
  const today = startOfTodayIst();
  if (range === 'today') return today;
  const days = range === '7d' ? 6 : 29;
  return new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
}

function startOfTodayIst(): Date {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(Date.now() + istOffsetMs);
  const startUtcMs =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) -
    istOffsetMs;
  return new Date(startUtcMs);
}
