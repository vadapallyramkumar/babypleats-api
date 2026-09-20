import { CouponType, type Coupon } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { roundMoney } from '../orders/shipping';

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export function computeCouponDiscount(coupon: Coupon, subtotal: number) {
  if (coupon.minSubtotal != null && subtotal < coupon.minSubtotal) {
    throw new BadRequestException(
      `This code needs a minimum cart of ₹${Math.round(coupon.minSubtotal)}`,
    );
  }

  let discount = 0;
  if (coupon.type === CouponType.percent) {
    discount = roundMoney((subtotal * coupon.value) / 100);
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.value;
  }

  return roundMoney(Math.max(0, Math.min(discount, subtotal)));
}

export function assertCouponWindow(coupon: Coupon, now = new Date()) {
  if (!coupon.isActive) {
    throw new BadRequestException('This coupon is not active');
  }
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new BadRequestException('This coupon is not active yet');
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    throw new BadRequestException('This coupon has expired');
  }
}
