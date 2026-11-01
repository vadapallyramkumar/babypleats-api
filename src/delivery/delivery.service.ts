import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryCalculatorService } from './delivery-calculator.service';
import {
  mapDeliveryHoliday,
  mapDeliveryRegion,
  mapDeliverySettings,
  parseDateOnly,
  parsePincodePrefixes,
  parseWorkingDays,
  toDateOnly,
} from './delivery.mappers';
import type { CreateDeliveryHolidayDto } from './dto/create-delivery-holiday.dto';
import type { CreateDeliveryRegionDto } from './dto/create-delivery-region.dto';
import type { DeliveryEstimateDto } from './dto/delivery-estimate.dto';
import type { UpdateDeliverySettingsDto } from './dto/delivery-settings.dto';
import type { UpdateDeliveryHolidayDto } from './dto/update-delivery-holiday.dto';
import type { UpdateDeliveryRegionDto } from './dto/update-delivery-region.dto';

const SETTINGS_ID = 'default';

export type DeliveryEstimateSnapshot = {
  estimatedDeliveryFrom: Date;
  estimatedDeliveryTo: Date;
  deliveryRegionName: string;
  deliveryEstimateCalculatedAt: Date;
  serviceable: boolean;
  message: string;
};

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: DeliveryCalculatorService,
  ) {}

  async estimate(body: DeliveryEstimateDto) {
    const pincode = body.pincode.trim();
    const settings = await this.ensureSettings();
    if (!settings.enabled) {
      throw new ServiceUnavailableException(
        'Delivery estimates are temporarily unavailable',
      );
    }

    const [regions, holidays] = await Promise.all([
      this.prisma.deliveryRegion.findMany({
        where: { isActive: true },
      }),
      this.prisma.deliveryHoliday.findMany({
        select: { date: true },
      }),
    ]);

    const mappedRegions = regions.map((r) => ({
      id: r.id,
      name: r.name,
      pincodePrefixes: parsePincodePrefixes(r.pincodePrefixes),
      transitMinDays: r.transitMinDays,
      transitMaxDays: r.transitMaxDays,
      isActive: r.isActive,
    }));

    const matched = this.calculator.matchRegion(pincode, mappedRegions);
    const region = matched
      ? { id: matched.id, name: matched.name }
      : { id: 'standard', name: this.calculator.standardRegionLabel() };

    const range = this.calculator.calculate({
      preparationMinDays: settings.preparationMinDays,
      preparationMaxDays: settings.preparationMaxDays,
      transitMinDays:
        matched?.transitMinDays ?? settings.defaultTransitMinDays,
      transitMaxDays:
        matched?.transitMaxDays ?? settings.defaultTransitMaxDays,
      cutoffTime: settings.cutoffTime,
      timezone: settings.timezone,
      workingDays: parseWorkingDays(settings.workingDays),
      holidayDates: holidays.map((h) => toDateOnly(h.date)),
    });

    return {
      serviceable: true,
      pincode,
      region,
      preparation: {
        minDays: range.preparationMinDays,
        maxDays: range.preparationMaxDays,
      },
      transit: {
        minDays: range.transitMinDays,
        maxDays: range.transitMaxDays,
      },
      estimatedDelivery: {
        from: range.from,
        to: range.to,
      },
      message: this.calculator.formatMessage(range.from, range.to),
    };
  }

  /**
   * Server-side estimate for checkout. Validates pincode and throws if
   * estimates cannot be produced. Never trusts client-provided dates.
   */
  async snapshotForCheckout(pincodeRaw: string): Promise<DeliveryEstimateSnapshot> {
    const pincode = pincodeRaw.trim();
    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('pincode must be exactly 6 digits');
    }

    const estimate = await this.estimate({ pincode });
    const calculatedAt = new Date();

    return {
      estimatedDeliveryFrom: parseDateOnly(estimate.estimatedDelivery.from),
      estimatedDeliveryTo: parseDateOnly(estimate.estimatedDelivery.to),
      deliveryRegionName: estimate.region.name,
      deliveryEstimateCalculatedAt: calculatedAt,
      serviceable: estimate.serviceable,
      message: estimate.message,
    };
  }

  async getSettings() {
    const row = await this.ensureSettings();
    return mapDeliverySettings(row);
  }

  async updateSettings(body: UpdateDeliverySettingsDto) {
    const existing = await this.ensureSettings();

    const preparationMinDays =
      body.preparationMinDays ?? existing.preparationMinDays;
    const preparationMaxDays =
      body.preparationMaxDays ?? existing.preparationMaxDays;
    const defaultTransitMinDays =
      body.defaultTransitMinDays ?? existing.defaultTransitMinDays;
    const defaultTransitMaxDays =
      body.defaultTransitMaxDays ?? existing.defaultTransitMaxDays;

    if (preparationMinDays > preparationMaxDays) {
      throw new BadRequestException(
        'preparationMinDays must not exceed preparationMaxDays',
      );
    }
    if (defaultTransitMinDays > defaultTransitMaxDays) {
      throw new BadRequestException(
        'defaultTransitMinDays must not exceed defaultTransitMaxDays',
      );
    }

    const row = await this.prisma.deliverySetting.update({
      where: { id: SETTINGS_ID },
      data: {
        ...(body.preparationMinDays !== undefined
          ? { preparationMinDays: body.preparationMinDays }
          : {}),
        ...(body.preparationMaxDays !== undefined
          ? { preparationMaxDays: body.preparationMaxDays }
          : {}),
        ...(body.defaultTransitMinDays !== undefined
          ? { defaultTransitMinDays: body.defaultTransitMinDays }
          : {}),
        ...(body.defaultTransitMaxDays !== undefined
          ? { defaultTransitMaxDays: body.defaultTransitMaxDays }
          : {}),
        ...(body.cutoffTime !== undefined
          ? { cutoffTime: body.cutoffTime.trim() }
          : {}),
        ...(body.timezone !== undefined
          ? { timezone: body.timezone.trim() }
          : {}),
        ...(body.workingDays !== undefined
          ? { workingDays: body.workingDays }
          : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      },
    });

    return mapDeliverySettings(row);
  }

  async listRegions() {
    const rows = await this.prisma.deliveryRegion.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapDeliveryRegion);
  }

  async getRegion(id: string) {
    const row = await this.prisma.deliveryRegion.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Delivery region not found');
    return mapDeliveryRegion(row);
  }

  async createRegion(body: CreateDeliveryRegionDto) {
    this.assertTransitRange(body.transitMinDays, body.transitMaxDays);
    const prefixes = normalizePrefixes(body.pincodePrefixes);

    const row = await this.prisma.deliveryRegion.create({
      data: {
        name: body.name.trim(),
        pincodePrefixes: prefixes,
        transitMinDays: body.transitMinDays,
        transitMaxDays: body.transitMaxDays,
        isActive: body.isActive ?? true,
      },
    });
    return mapDeliveryRegion(row);
  }

  async updateRegion(id: string, body: UpdateDeliveryRegionDto) {
    const existing = await this.prisma.deliveryRegion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Delivery region not found');

    const transitMinDays = body.transitMinDays ?? existing.transitMinDays;
    const transitMaxDays = body.transitMaxDays ?? existing.transitMaxDays;
    this.assertTransitRange(transitMinDays, transitMaxDays);

    const row = await this.prisma.deliveryRegion.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.pincodePrefixes !== undefined
          ? { pincodePrefixes: normalizePrefixes(body.pincodePrefixes) }
          : {}),
        ...(body.transitMinDays !== undefined
          ? { transitMinDays: body.transitMinDays }
          : {}),
        ...(body.transitMaxDays !== undefined
          ? { transitMaxDays: body.transitMaxDays }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    return mapDeliveryRegion(row);
  }

  async removeRegion(id: string) {
    const existing = await this.prisma.deliveryRegion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Delivery region not found');
    await this.prisma.deliveryRegion.delete({ where: { id } });
  }

  async listHolidays(year?: number) {
    const where: Prisma.DeliveryHolidayWhereInput = {};
    if (year !== undefined) {
      if (!Number.isInteger(year) || year < 1970 || year > 2100) {
        throw new BadRequestException('year must be a valid calendar year');
      }
      where.date = {
        gte: parseDateOnly(`${year}-01-01`),
        lte: parseDateOnly(`${year}-12-31`),
      };
    }

    const rows = await this.prisma.deliveryHoliday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return rows.map(mapDeliveryHoliday);
  }

  async createHoliday(body: CreateDeliveryHolidayDto) {
    let date: Date;
    try {
      date = parseDateOnly(body.date);
    } catch {
      throw new BadRequestException('date must be a valid calendar date');
    }

    try {
      const row = await this.prisma.deliveryHoliday.create({
        data: {
          date,
          name: body.name.trim(),
        },
      });
      return mapDeliveryHoliday(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'A holiday for this date already exists',
        );
      }
      throw e;
    }
  }

  async updateHoliday(id: string, body: UpdateDeliveryHolidayDto) {
    const existing = await this.prisma.deliveryHoliday.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Delivery holiday not found');

    let date: Date | undefined;
    if (body.date !== undefined) {
      try {
        date = parseDateOnly(body.date);
      } catch {
        throw new BadRequestException('date must be a valid calendar date');
      }
    }

    try {
      const row = await this.prisma.deliveryHoliday.update({
        where: { id },
        data: {
          ...(date ? { date } : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        },
      });
      return mapDeliveryHoliday(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'A holiday for this date already exists',
        );
      }
      throw e;
    }
  }

  async removeHoliday(id: string) {
    const existing = await this.prisma.deliveryHoliday.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Delivery holiday not found');
    await this.prisma.deliveryHoliday.delete({ where: { id } });
  }

  private async ensureSettings() {
    const existing = await this.prisma.deliverySetting.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) return existing;

    try {
      return await this.prisma.deliverySetting.create({
        data: { id: SETTINGS_ID },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const row = await this.prisma.deliverySetting.findUnique({
          where: { id: SETTINGS_ID },
        });
        if (row) return row;
      }
      throw e;
    }
  }

  private assertTransitRange(min: number, max: number) {
    if (min > max) {
      throw new BadRequestException(
        'transitMinDays must not exceed transitMaxDays',
      );
    }
  }
}

function normalizePrefixes(prefixes: string[]): string[] {
  const cleaned = prefixes.map((p) => p.trim());
  const seen = new Set<string>();
  for (const prefix of cleaned) {
    if (!/^\d{1,5}$/.test(prefix)) {
      throw new BadRequestException(
        'each pincode prefix must be 1–5 digits',
      );
    }
    if (seen.has(prefix)) {
      throw new BadRequestException(
        `Duplicate pincode prefix “${prefix}” in this region`,
      );
    }
    seen.add(prefix);
  }
  return cleaned;
}
