import type {
  DeliveryHoliday,
  DeliveryRegion,
  DeliverySetting,
} from '@prisma/client';
import { DateTime } from 'luxon';

export function parseWorkingDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [1, 2, 3, 4, 5, 6];
  const days = raw
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function parsePincodePrefixes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => String(p).trim()).filter(Boolean);
}

export function mapDeliverySettings(row: DeliverySetting) {
  return {
    id: row.id,
    preparationMinDays: row.preparationMinDays,
    preparationMaxDays: row.preparationMaxDays,
    defaultTransitMinDays: row.defaultTransitMinDays,
    defaultTransitMaxDays: row.defaultTransitMaxDays,
    cutoffTime: row.cutoffTime,
    timezone: row.timezone,
    workingDays: parseWorkingDays(row.workingDays),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapDeliveryRegion(row: DeliveryRegion) {
  return {
    id: row.id,
    name: row.name,
    pincodePrefixes: parsePincodePrefixes(row.pincodePrefixes),
    transitMinDays: row.transitMinDays,
    transitMaxDays: row.transitMaxDays,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapDeliveryHoliday(row: DeliveryHoliday) {
  return {
    id: row.id,
    date: toDateOnly(row.date),
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDateOnly(value: Date): string {
  return DateTime.fromJSDate(value, { zone: 'utc' }).toISODate()!;
}

/** Store a YYYY-MM-DD as a UTC midnight Date for Prisma `@db.Date` columns. */
export function parseDateOnly(value: string, field = 'date'): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = DateTime.utc(year, month, day);
  if (!dt.isValid || dt.day !== day || dt.month !== month) {
    throw new Error(`${field} must be a valid calendar date`);
  }
  return dt.toJSDate();
}

export type MappedDeliverySettings = ReturnType<typeof mapDeliverySettings>;
export type MappedDeliveryRegion = ReturnType<typeof mapDeliveryRegion>;
export type MappedDeliveryHoliday = ReturnType<typeof mapDeliveryHoliday>;
