import type {
  HeroImage,
  PromotionalMessage,
  SocialLink,
} from '@prisma/client';

export function mapHeroImage(row: HeroImage) {
  return {
    id: row.id,
    url: row.url,
    mobileUrl: row.mobileUrl,
    alt: row.alt,
    order: row.sortOrder,
    active: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapPromotionalMessage(row: PromotionalMessage) {
  return {
    id: row.id,
    message: row.message,
    order: row.sortOrder,
    active: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSocialLink(row: SocialLink) {
  return {
    id: row.id,
    platform: row.platform,
    url: row.url,
    icon: row.icon,
    order: row.sortOrder,
    active: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
