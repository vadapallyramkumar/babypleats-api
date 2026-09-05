import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SocialMediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapHeroImage,
  mapPromotionalMessage,
  mapSocialLink,
} from './home.mappers';

const SOCIAL_MEDIA_TYPES = new Set<string>(Object.values(SocialMediaType));

export type HeroImageWriteBody = {
  url: string;
  mobileUrl?: string | null;
  alt: string;
  order?: number;
  active?: boolean;
};

export type PromotionalMessageWriteBody = {
  message: string;
  order?: number;
  active?: boolean;
};

export type SocialLinkWriteBody = {
  url: string;
  type: SocialMediaType | string;
  order?: number;
  active?: boolean;
};

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

function assertHttpUrl(value: unknown, field: string): string {
  const raw = assertNonEmptyString(value, field);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException(`Invalid ${field}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return raw;
}

function assertOptionalHttpUrl(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return assertHttpUrl(value, field);
}

function assertOptionalInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new BadRequestException(`${field} must be an integer`);
  }
  return n;
}

function assertOptionalBool(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be a boolean`);
  }
  return value;
}

function assertMediaType(value: unknown): SocialMediaType {
  const raw = assertNonEmptyString(value, 'type').toLowerCase();
  if (!SOCIAL_MEDIA_TYPES.has(raw)) {
    throw new BadRequestException(
      `type must be one of: ${[...SOCIAL_MEDIA_TYPES].join(', ')}`,
    );
  }
  return raw as SocialMediaType;
}

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Hero images ---

  async listHeroImages(opts: { includeInactive?: boolean } = {}) {
    const rows = await this.prisma.heroImage.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapHeroImage);
  }

  async getHeroImage(id: string) {
    const row = await this.prisma.heroImage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Hero image not found');
    return mapHeroImage(row);
  }

  async createHeroImage(body: HeroImageWriteBody) {
    const data = this.parseHeroCreate(body);
    const row = await this.prisma.heroImage.create({ data });
    return mapHeroImage(row);
  }

  async updateHeroImage(id: string, body: Partial<HeroImageWriteBody>) {
    await this.requireHero(id);
    const data = this.parseHeroUpdate(body);
    const row = await this.prisma.heroImage.update({ where: { id }, data });
    return mapHeroImage(row);
  }

  async deleteHeroImage(id: string) {
    await this.requireHero(id);
    await this.prisma.heroImage.delete({ where: { id } });
  }

  // --- Promotional messages ---

  async listPromotionalMessages(opts: { includeInactive?: boolean } = {}) {
    const rows = await this.prisma.promotionalMessage.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapPromotionalMessage);
  }

  async getPromotionalMessage(id: string) {
    const row = await this.prisma.promotionalMessage.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Promotional message not found');
    return mapPromotionalMessage(row);
  }

  async createPromotionalMessage(body: PromotionalMessageWriteBody) {
    const data = this.parsePromoCreate(body);
    const row = await this.prisma.promotionalMessage.create({ data });
    return mapPromotionalMessage(row);
  }

  async updatePromotionalMessage(
    id: string,
    body: Partial<PromotionalMessageWriteBody>,
  ) {
    await this.requirePromo(id);
    const data = this.parsePromoUpdate(body);
    const row = await this.prisma.promotionalMessage.update({
      where: { id },
      data,
    });
    return mapPromotionalMessage(row);
  }

  async deletePromotionalMessage(id: string) {
    await this.requirePromo(id);
    await this.prisma.promotionalMessage.delete({ where: { id } });
  }

  // --- Social links ---

  async listSocialLinks(opts: { includeInactive?: boolean } = {}) {
    const rows = await this.prisma.socialLink.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapSocialLink);
  }

  async getSocialLink(id: string) {
    const row = await this.prisma.socialLink.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Social link not found');
    return mapSocialLink(row);
  }

  async createSocialLink(body: SocialLinkWriteBody) {
    const data = this.parseSocialCreate(body);
    const row = await this.prisma.socialLink.create({ data });
    return mapSocialLink(row);
  }

  async updateSocialLink(id: string, body: Partial<SocialLinkWriteBody>) {
    await this.requireSocial(id);
    const data = this.parseSocialUpdate(body);
    const row = await this.prisma.socialLink.update({ where: { id }, data });
    return mapSocialLink(row);
  }

  async deleteSocialLink(id: string) {
    await this.requireSocial(id);
    await this.prisma.socialLink.delete({ where: { id } });
  }

  // --- helpers ---

  private async requireHero(id: string) {
    const row = await this.prisma.heroImage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Hero image not found');
    return row;
  }

  private async requirePromo(id: string) {
    const row = await this.prisma.promotionalMessage.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Promotional message not found');
    return row;
  }

  private async requireSocial(id: string) {
    const row = await this.prisma.socialLink.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Social link not found');
    return row;
  }

  private parseHeroCreate(
    body: HeroImageWriteBody,
  ): Prisma.HeroImageCreateInput {
    return {
      url: assertHttpUrl(body.url, 'url'),
      mobileUrl: assertOptionalHttpUrl(body.mobileUrl, 'mobileUrl') ?? null,
      alt: assertNonEmptyString(body.alt, 'alt'),
      sortOrder: assertOptionalInt(body.order, 'order') ?? 0,
      isActive: assertOptionalBool(body.active, 'active') ?? true,
    };
  }

  private parseHeroUpdate(
    body: Partial<HeroImageWriteBody>,
  ): Prisma.HeroImageUpdateInput {
    const data: Prisma.HeroImageUpdateInput = {};
    if (body.url !== undefined) data.url = assertHttpUrl(body.url, 'url');
    if (body.mobileUrl !== undefined) {
      data.mobileUrl =
        assertOptionalHttpUrl(body.mobileUrl, 'mobileUrl') ?? null;
    }
    if (body.alt !== undefined) data.alt = assertNonEmptyString(body.alt, 'alt');
    if (body.order !== undefined) {
      data.sortOrder = assertOptionalInt(body.order, 'order');
    }
    if (body.active !== undefined) {
      data.isActive = assertOptionalBool(body.active, 'active');
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    return data;
  }

  private parsePromoCreate(
    body: PromotionalMessageWriteBody,
  ): Prisma.PromotionalMessageCreateInput {
    return {
      message: assertNonEmptyString(body.message, 'message'),
      sortOrder: assertOptionalInt(body.order, 'order') ?? 0,
      isActive: assertOptionalBool(body.active, 'active') ?? true,
    };
  }

  private parsePromoUpdate(
    body: Partial<PromotionalMessageWriteBody>,
  ): Prisma.PromotionalMessageUpdateInput {
    const data: Prisma.PromotionalMessageUpdateInput = {};
    if (body.message !== undefined) {
      data.message = assertNonEmptyString(body.message, 'message');
    }
    if (body.order !== undefined) {
      data.sortOrder = assertOptionalInt(body.order, 'order');
    }
    if (body.active !== undefined) {
      data.isActive = assertOptionalBool(body.active, 'active');
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    return data;
  }

  private parseSocialCreate(
    body: SocialLinkWriteBody,
  ): Prisma.SocialLinkCreateInput {
    return {
      url: assertHttpUrl(body.url, 'url'),
      type: assertMediaType(body.type),
      sortOrder: assertOptionalInt(body.order, 'order') ?? 0,
      isActive: assertOptionalBool(body.active, 'active') ?? true,
    };
  }

  private parseSocialUpdate(
    body: Partial<SocialLinkWriteBody>,
  ): Prisma.SocialLinkUpdateInput {
    const data: Prisma.SocialLinkUpdateInput = {};
    if (body.url !== undefined) data.url = assertHttpUrl(body.url, 'url');
    if (body.type !== undefined) data.type = assertMediaType(body.type);
    if (body.order !== undefined) {
      data.sortOrder = assertOptionalInt(body.order, 'order');
    }
    if (body.active !== undefined) {
      data.isActive = assertOptionalBool(body.active, 'active');
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    return data;
  }
}
