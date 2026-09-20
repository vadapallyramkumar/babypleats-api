import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_SHIPPING_FEE,
} from './orders.constants';

export function shippingConfig() {
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD);
  const fee = Number(process.env.SHIPPING_FEE);
  return {
    freeShippingThreshold: Number.isFinite(threshold)
      ? threshold
      : DEFAULT_FREE_SHIPPING_THRESHOLD,
    shippingFee: Number.isFinite(fee) ? fee : DEFAULT_SHIPPING_FEE,
  };
}

export function computeShipping(subtotal: number) {
  const { freeShippingThreshold, shippingFee } = shippingConfig();
  if (subtotal <= 0 || subtotal >= freeShippingThreshold) return 0;
  return shippingFee;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
