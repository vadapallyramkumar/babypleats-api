import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import type { ApiVariant } from '../common/mappers';
import { serializeVariants } from '../common/mappers';

function parseVariants(raw: string): ApiVariant[] {
  try {
    const parsed = JSON.parse(raw) as ApiVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type StockLine = {
  productId: string;
  variantId: string;
  qty: number;
};

export async function lockProducts(
  tx: Prisma.TransactionClient,
  productIds: string[],
) {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRawUnsafe(
    `SELECT id FROM "Product" WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')}) FOR UPDATE`,
    ...ids,
  );
}

export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  lines: StockLine[],
  direction: 'decrement' | 'restore',
) {
  const byProduct = new Map<string, StockLine[]>();
  for (const line of lines) {
    const list = byProduct.get(line.productId) ?? [];
    list.push(line);
    byProduct.set(line.productId, list);
  }

  await lockProducts(tx, [...byProduct.keys()]);

  for (const [productId, productLines] of byProduct) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new BadRequestException(`Unknown product ${productId}`);
    }

    const variants = parseVariants(product.variants);
    for (const line of productLines) {
      const variant = variants.find((v) => v.id === line.variantId);
      if (!variant) {
        throw new BadRequestException(
          `Unknown variant ${line.variantId} on product ${productId}`,
        );
      }
      const delta = direction === 'decrement' ? -line.qty : line.qty;
      variant.stock = Math.max(0, variant.stock + delta);
    }

    await tx.product.update({
      where: { id: productId },
      data: { variants: serializeVariants(variants) },
    });
  }
}
