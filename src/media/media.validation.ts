import { BadRequestException } from '@nestjs/common';
import { fromBuffer } from 'file-type';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

/** Images: 10MB; videos: 50MB */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const EXT_BY_MIME: Record<AllowedMediaMimeType, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'video/mp4': ['mp4', 'm4v'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
};

function extensionOf(originalname: string): string {
  const parts = originalname.split('.');
  if (parts.length < 2) return '';
  return parts.pop()!.toLowerCase();
}

function isAllowedMime(mime: string): mime is AllowedMediaMimeType {
  return (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mime);
}

export async function validateUploadedMedia(
  file: Express.Multer.File | undefined,
): Promise<{
  file: Express.Multer.File;
  resourceType: 'image' | 'video';
  mime: AllowedMediaMimeType;
}> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Media file is required');
  }

  const claimed = (file.mimetype || '').toLowerCase().trim();
  if (!isAllowedMime(claimed)) {
    throw new BadRequestException(
      `Unsupported media type "${claimed || 'unknown'}". Allowed: ${ALLOWED_MEDIA_MIME_TYPES.join(', ')}`,
    );
  }

  const detected = await fromBuffer(file.buffer);
  if (!detected?.mime || !isAllowedMime(detected.mime)) {
    throw new BadRequestException(
      'File content does not match an allowed image/video format',
    );
  }

  if (detected.mime !== claimed) {
    throw new BadRequestException(
      `Declared type "${claimed}" does not match file content "${detected.mime}"`,
    );
  }

  const ext = extensionOf(file.originalname || '');
  const allowedExts = EXT_BY_MIME[detected.mime];
  if (ext && !allowedExts.includes(ext)) {
    throw new BadRequestException(
      `File extension ".${ext}" does not match type ${detected.mime}`,
    );
  }

  const resourceType = detected.mime.startsWith('video/') ? 'video' : 'image';
  const maxBytes = resourceType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new BadRequestException(
      `${resourceType === 'video' ? 'Video' : 'Image'} must be at most ${limitMb}MB`,
    );
  }

  return { file, resourceType, mime: detected.mime };
}
