import type { Coupon } from '@prisma/client';

export function mapCoupon(coupon: Coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minSubtotal: coupon.minSubtotal,
    maxDiscount: coupon.maxDiscount,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    endsAt: coupon.endsAt?.toISOString() ?? null,
    maxRedemptions: coupon.maxRedemptions,
    maxPerCustomer: coupon.maxPerCustomer,
    isActive: coupon.isActive,
    redemptionCount: coupon.redemptionCount,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export type MappedCoupon = ReturnType<typeof mapCoupon>;
