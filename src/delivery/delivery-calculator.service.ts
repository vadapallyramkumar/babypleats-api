import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

/**
 * Delivery estimate convention (documented + covered by unit tests):
 *
 * 1. All calendar arithmetic uses the configured IANA timezone (never the
 *    server local timezone). Returned dates are calendar dates (YYYY-MM-DD)
 *    in that timezone.
 * 2. The order placement calendar day is never counted as a preparation day.
 * 3. Cutoff: if the current local time is at or after `cutoffTime` (HH:mm),
 *    the order is treated as placed on the next calendar day first.
 * 4. The "order accepted" date is then advanced to the next working day if
 *    needed (non-working weekdays and holidays are skipped).
 * 5. Preparation day 1 is the first working day AFTER the order-accepted date.
 *    Counting N preparation working days yields the dispatch date.
 * 6. Transit starts on the first working day AFTER dispatch. Counting M
 *    transit working days yields the estimated delivery date.
 * 7. Working days are taken from settings (not hardcoded Mon–Sat). Holidays
 *    are always excluded regardless of weekday.
 */

export type DeliveryCalcSettings = {
  preparationMinDays: number;
  preparationMaxDays: number;
  transitMinDays: number;
  transitMaxDays: number;
  cutoffTime: string;
  timezone: string;
  workingDays: number[];
  holidayDates: string[];
};

export type DeliveryDateRange = {
  from: string;
  to: string;
  preparationMinDays: number;
  preparationMaxDays: number;
  transitMinDays: number;
  transitMaxDays: number;
};

export type MatchedRegion = {
  id: string;
  name: string;
  transitMinDays: number;
  transitMaxDays: number;
};

const STANDARD_REGION_NAME = 'Standard Delivery';

@Injectable()
export class DeliveryCalculatorService {
  /**
   * Longest-prefix match against active regions. Returns null when no prefix
   * matches (caller should fall back to default transit settings).
   */
  matchRegion(
    pincode: string,
    regions: Array<{
      id: string;
      name: string;
      pincodePrefixes: string[];
      transitMinDays: number;
      transitMaxDays: number;
      isActive: boolean;
    }>,
  ): MatchedRegion | null {
    const pin = pincode.trim();
    let best: MatchedRegion | null = null;
    let bestLen = -1;

    for (const region of regions) {
      if (!region.isActive) continue;
      for (const raw of region.pincodePrefixes) {
        const prefix = String(raw).trim();
        if (!prefix || !pin.startsWith(prefix)) continue;
        if (prefix.length > bestLen) {
          bestLen = prefix.length;
          best = {
            id: region.id,
            name: region.name,
            transitMinDays: region.transitMinDays,
            transitMaxDays: region.transitMaxDays,
          };
        }
      }
    }

    return best;
  }

  standardRegionLabel(): string {
    return STANDARD_REGION_NAME;
  }

  calculate(
    settings: DeliveryCalcSettings,
    now: Date = new Date(),
  ): DeliveryDateRange {
    const zone = settings.timezone;
    const working = new Set(settings.workingDays);
    const holidays = new Set(settings.holidayDates);

    let cursor = DateTime.fromJSDate(now, { zone });
    if (!cursor.isValid) {
      throw new Error(`Invalid timezone or timestamp: ${zone}`);
    }

    const [cutoffHour, cutoffMinute] = parseCutoff(settings.cutoffTime);
    const minutesNow = cursor.hour * 60 + cursor.minute;
    const cutoffMinutes = cutoffHour * 60 + cutoffMinute;
    if (minutesNow >= cutoffMinutes) {
      cursor = cursor.plus({ days: 1 }).startOf('day');
    } else {
      cursor = cursor.startOf('day');
    }

    const orderAccepted = nextWorkingDayOnOrAfter(cursor, working, holidays);
    const prepStart = nextWorkingDayAfter(orderAccepted, working, holidays);

    const dispatchMin = addWorkingDays(
      prepStart,
      settings.preparationMinDays,
      working,
      holidays,
    );
    const dispatchMax = addWorkingDays(
      prepStart,
      settings.preparationMaxDays,
      working,
      holidays,
    );

    const deliveryFrom = addTransitDays(
      dispatchMin,
      settings.transitMinDays,
      working,
      holidays,
    );
    const deliveryTo = addTransitDays(
      dispatchMax,
      settings.transitMaxDays,
      working,
      holidays,
    );

    return {
      from: deliveryFrom.toISODate()!,
      to: deliveryTo.toISODate()!,
      preparationMinDays: settings.preparationMinDays,
      preparationMaxDays: settings.preparationMaxDays,
      transitMinDays: settings.transitMinDays,
      transitMaxDays: settings.transitMaxDays,
    };
  }

  formatMessage(from: string, to: string): string {
    if (from === to) {
      return `Estimated delivery on ${formatDisplayDate(from)}.`;
    }
    return `Estimated delivery between ${formatDisplayDate(from)} and ${formatDisplayDate(to)}.`;
  }
}

function parseCutoff(cutoffTime: string): [number, number] {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(cutoffTime.trim());
  if (!match) return [14, 0];
  return [Number(match[1]), Number(match[2])];
}

function isWorkingDay(
  date: DateTime,
  working: Set<number>,
  holidays: Set<string>,
): boolean {
  const iso = date.toISODate();
  if (!iso || holidays.has(iso)) return false;
  return working.has(date.weekday % 7);
}

/**
 * Luxon: Monday = 1 … Sunday = 7.
 * Settings use JS convention: Sunday = 0 … Saturday = 6.
 * Mapping: luxon weekday % 7 → JS weekday (Sunday 7 % 7 = 0).
 */
function nextWorkingDayOnOrAfter(
  date: DateTime,
  working: Set<number>,
  holidays: Set<string>,
): DateTime {
  let d = date.startOf('day');
  for (let i = 0; i < 3660; i += 1) {
    if (isWorkingDay(d, working, holidays)) return d;
    d = d.plus({ days: 1 });
  }
  throw new Error('Unable to find a working day within 10 years');
}

function nextWorkingDayAfter(
  date: DateTime,
  working: Set<number>,
  holidays: Set<string>,
): DateTime {
  return nextWorkingDayOnOrAfter(date.plus({ days: 1 }), working, holidays);
}

/**
 * Advance `days` working days inclusive of the start date as day 1.
 * Example: start=Tue, days=2 → Wed.
 */
function addWorkingDays(
  start: DateTime,
  days: number,
  working: Set<number>,
  holidays: Set<string>,
): DateTime {
  if (days <= 0) {
    return start.startOf('day');
  }
  let d = start.startOf('day');
  if (!isWorkingDay(d, working, holidays)) {
    d = nextWorkingDayOnOrAfter(d, working, holidays);
  }
  let counted = 1;
  while (counted < days) {
    d = nextWorkingDayAfter(d, working, holidays);
    counted += 1;
  }
  return d;
}

/**
 * Transit starts the working day after dispatch. Zero transit days means
 * delivery on the dispatch date itself (still snapped to a working day).
 */
function addTransitDays(
  dispatch: DateTime,
  transitDays: number,
  working: Set<number>,
  holidays: Set<string>,
): DateTime {
  if (transitDays <= 0) {
    return nextWorkingDayOnOrAfter(dispatch, working, holidays);
  }
  return addWorkingDays(
    nextWorkingDayAfter(dispatch, working, holidays),
    transitDays,
    working,
    holidays,
  );
}

function formatDisplayDate(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate, { zone: 'utc' });
  if (!dt.isValid) return isoDate;
  return dt.toFormat('dd LLL');
}
