import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { ApiVariant } from '../common/mappers';
import type { CheckoutItemDto } from './dto/checkout.dto';
import { roundMoney } from './shipping';

export type SnapshotLine = {
  productId: string;
  variantId: string;
  productName: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  qty: number;
  unitPrice: number;
};

export async function snapshotCartItems(
  prisma: PrismaClient,
  items: CheckoutItemDto[],
): Promise<SnapshotLine[]> {
  const merged = new Map<string, { productId: string; variantId: string; qty: number }>();
  for (const item of items) {
    const key = `${item.productId}::${item.variantId}`;
    const current = merged.get(key);
    if (current) {
      current.qty += item.qty;
    } else {
      merged.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        qty: item.qty,
      });
    }
  }

  const productIds = [...new Set([...merged.values()].map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: SnapshotLine[] = [];
  for (const item of merged.values()) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) {
      throw new BadRequestException(`Product ${item.productId} is unavailable`);
    }
    const variants = parseVariants(product.variants);
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.isActive) {
      throw new BadRequestException(`Variant ${item.variantId} is unavailable`);
    }
    if (variant.stock < item.qty) {
      throw new BadRequestException(
        `Not enough stock for ${product.name} (${variant.color} · ${variant.size})`,
      );
    }
    lines.push({
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      sku: variant.sku ?? null,
      size: variant.size ?? null,
      color: variant.color ?? null,
      qty: item.qty,
      unitPrice: variant.price.selling,
    });
  }
  return lines;
}

export function linesSubtotal(lines: SnapshotLine[]) {
  return roundMoney(
    lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
  );
}

function parseVariants(raw: string): ApiVariant[] {
  try {
    const parsed = JSON.parse(raw) as ApiVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
