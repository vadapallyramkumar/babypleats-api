import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CouponType,
  OrderStatus,
  Prisma,
  type Coupon,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeShipping, roundMoney } from '../orders/shipping';
import {
  linesSubtotal,
  snapshotCartItems,
} from '../orders/snapshot-items';
import {
  assertCouponWindow,
  computeCouponDiscount,
  normalizeCouponCode,
} from './coupon.pricing';
import { mapCoupon } from './coupons.mappers';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';
import type { ValidateCouponDto } from './dto/validate-coupon.dto';

export type AppliedCoupon = {
  coupon: Coupon;
  discount: number;
};

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapCoupon);
  }

  async getById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return mapCoupon(coupon);
  }

  async create(body: CreateCouponDto) {
    const data: Prisma.CouponCreateInput = {
      code: normalizeCouponCode(body.code),
      type: body.type,
      value: body.value,
      minSubtotal: body.minSubtotal ?? null,
      maxDiscount: body.maxDiscount ?? null,
      startsAt: parseOptionalDate(body.startsAt, 'start'),
      endsAt: parseOptionalDate(body.endsAt, 'end'),
      maxRedemptions: body.maxRedemptions ?? null,
      maxPerCustomer: body.maxPerCustomer === undefined ? 1 : body.maxPerCustomer,
      isActive: body.isActive ?? true,
    };
    if (data.type === CouponType.percent && data.value > 100) {
      throw new BadRequestException('Percent coupons cannot exceed 100');
    }
    try {
      const row = await this.prisma.coupon.create({ data });
      return mapCoupon(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A coupon with this code already exists');
      }
      throw e;
    }
  }

  async update(id: string, body: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    const data = this.toCouponPatch(body, existing);
    try {
      const row = await this.prisma.coupon.update({ where: { id }, data });
      return mapCoupon(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A coupon with this code already exists');
      }
      throw e;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    const used = await this.prisma.order.count({ where: { couponId: id } });
    if (used > 0) {
      throw new ConflictException(
        'Coupon has been used on orders; deactivate it instead of deleting',
      );
    }
    await this.prisma.coupon.delete({ where: { id } });
  }

  async validatePublic(body: ValidateCouponDto) {
    const lines = await snapshotCartItems(this.prisma, body.items);
    const subtotal = linesSubtotal(lines);
    const shipping = computeShipping(subtotal);
    const applied = await this.evaluate(
      this.prisma,
      body.code,
      subtotal,
      body.phone?.trim(),
    );
    const total = roundMoney(subtotal - applied.discount + shipping);
    return {
      code: applied.coupon.code,
      type: applied.coupon.type,
      discount: applied.discount,
      totals: {
        subtotal,
        discount: applied.discount,
        shipping,
        total,
        currency: 'INR' as const,
      },
    };
  }

  async evaluate(
    db: Prisma.TransactionClient | PrismaService,
    code: string,
    subtotal: number,
    phone?: string,
  ): Promise<AppliedCoupon> {
    const normalized = normalizeCouponCode(code);
    if (!normalized) {
      throw new BadRequestException('Enter a coupon code');
    }

    const coupon = await db.coupon.findUnique({ where: { code: normalized } });
    if (!coupon) {
      throw new BadRequestException('This coupon is not valid');
    }

    assertCouponWindow(coupon);
    const discount = computeCouponDiscount(coupon, subtotal);
    await this.assertUsage(db, coupon, phone);
    return { coupon, discount };
  }

  async recordRedemption(
    tx: Prisma.TransactionClient,
    input: { couponId: string; orderId: string; phone: string },
  ) {
    const existing = await tx.couponRedemption.findUnique({
      where: { orderId: input.orderId },
    });
    if (existing) return;

    await tx.couponRedemption.create({
      data: {
        couponId: input.couponId,
        orderId: input.orderId,
        phone: input.phone,
      },
    });
    await tx.coupon.update({
      where: { id: input.couponId },
      data: { redemptionCount: { increment: 1 } },
    });
  }

  async releaseRedemption(tx: Prisma.TransactionClient, orderId: string) {
    const existing = await tx.couponRedemption.findUnique({
      where: { orderId },
    });
    if (!existing) return;
    await tx.couponRedemption.delete({ where: { id: existing.id } });
    await tx.coupon.update({
      where: { id: existing.couponId },
      data: { redemptionCount: { decrement: 1 } },
    });
  }

  private async assertUsage(
    db: Prisma.TransactionClient | PrismaService,
    coupon: Coupon,
    phone?: string,
  ) {
    if (coupon.maxRedemptions != null) {
      const used = await this.usageCount(db, coupon.id);
      if (used >= coupon.maxRedemptions) {
        throw new BadRequestException('This coupon has reached its usage limit');
      }
    }

    const perCustomer = coupon.maxPerCustomer ?? 1;
    if (phone && perCustomer > 0) {
      const usedByPhone = await this.usageCount(db, coupon.id, phone);
      if (usedByPhone >= perCustomer) {
        throw new BadRequestException(
          'This coupon has already been used on this number',
        );
      }
    }
  }

  private async usageCount(
    db: Prisma.TransactionClient | PrismaService,
    couponId: string,
    phone?: string,
  ) {
    const [completed, pending] = await Promise.all([
      db.couponRedemption.count({
        where: { couponId, ...(phone ? { phone } : {}) },
      }),
      db.order.count({
        where: {
          couponId,
          status: OrderStatus.pending_payment,
          ...(phone ? { customerPhone: phone } : {}),
        },
      }),
    ]);
    return completed + pending;
  }

  private toCouponPatch(body: UpdateCouponDto, existing: Coupon): Prisma.CouponUpdateInput {
    const type = body.type ?? existing.type;
    const value = body.value ?? existing.value;
    if (type === CouponType.percent && value > 100) {
      throw new BadRequestException('Percent coupons cannot exceed 100');
    }

    return {
      ...(body.code !== undefined
        ? { code: normalizeCouponCode(body.code) }
        : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.minSubtotal !== undefined ? { minSubtotal: body.minSubtotal } : {}),
      ...(body.maxDiscount !== undefined ? { maxDiscount: body.maxDiscount } : {}),
      ...(body.startsAt !== undefined
        ? { startsAt: parseOptionalDate(body.startsAt, 'start') }
        : {}),
      ...(body.endsAt !== undefined
        ? { endsAt: parseOptionalDate(body.endsAt, 'end') }
        : {}),
      ...(body.maxRedemptions !== undefined
        ? { maxRedemptions: body.maxRedemptions }
        : {}),
      ...(body.maxPerCustomer !== undefined
        ? { maxPerCustomer: body.maxPerCustomer }
        : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    };
  }
}

function parseOptionalDate(value: string | null | undefined, bound: 'start' | 'end') {
  if (value == null || value === '') return null;
  const raw = value.includes('T') ? value : `${value}T${bound === 'end' ? '23:59:59.999' : '00:00:00.000'}Z`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${bound} date`);
  }
  return date;
}
