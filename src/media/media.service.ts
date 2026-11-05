import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaAsset } from '@prisma/client';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_VIDEO_BYTES,
  validateUploadedMedia,
} from './media.validation';

type CloudinaryResource = {
  public_id?: string;
  secure_url?: string;
  url?: string;
  bytes?: number;
  format?: string;
  resource_type?: string;
  created_at?: string;
  original_filename?: string;
};

type CloudinaryListResult = {
  resources?: CloudinaryResource[];
  next_cursor?: string;
};

type MediaResourceType = 'image' | 'video';

const CLOUDINARY_SYNC_INTERVAL_MS = 30_000;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private lastCloudinarySyncAt = 0;
  private cloudinarySync: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.configureCloudinary();
  }

  private getCloudinaryCredentials() {
    return {
      cloudName: this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim(),
      apiKey: this.config.get<string>('CLOUDINARY_API_KEY')?.trim(),
      apiSecret: this.config.get<string>('CLOUDINARY_API_SECRET')?.trim(),
      uploadPreset: this.config.get<string>('CLOUDINARY_UPLOAD_PRESET')?.trim(),
    };
  }

  private configureCloudinary() {
    const { cloudName, apiKey, apiSecret } = this.getCloudinaryCredentials();

    if (!cloudName || !apiKey || !apiSecret) {
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  private assertCloudinaryReady() {
    const { cloudName, apiKey, apiSecret, uploadPreset } =
      this.getCloudinaryCredentials();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Cloudinary is not configured');
    }

    this.configureCloudinary();

    return { uploadPreset: uploadPreset || undefined };
  }

  private mediaFolder() {
    return (
      this.config.get<string>('CLOUDINARY_FOLDER')?.trim() ||
      'babypleats'
    );
  }

  /**
   * Log Cloudinary failure details for ops; never include credentials/secrets.
   * Returns a safe, actionable message suitable for API clients.
   */
  private reportCloudinaryFailure(
    error: unknown,
    operation: 'upload' | 'delete',
    label?: string,
  ) {
    const details = extractCloudinaryErrorDetails(error);
    const target = label?.trim() || operation;
    this.logger.error(
      `Cloudinary ${operation} failed for ${target}: name=${details.name ?? 'n/a'} http_code=${details.httpCode ?? 'n/a'} error_code=${details.errorCode ?? 'n/a'} message=${details.message}`,
    );
    return toSafeCloudinaryClientMessage(details, operation);
  }

  async list() {
    try {
      await this.syncFromCloudinary();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Cloudinary sync failed';
      this.logger.warn(`Media library sync skipped: ${message}`);
    }

    const rows = await this.prisma.mediaAsset.findMany({
      orderBy: { uploadedAt: 'desc' },
    });

    return rows.map((row) => this.toRecord(row));
  }

  async upload(file: Express.Multer.File, alt = '') {
    const { file: validated, resourceType } = await validateUploadedMedia(file);
    // Signed server-side upload_stream authenticates with API key/secret.
    // upload_preset is optional here (required only for unsigned client uploads).
    const { uploadPreset } = this.assertCloudinaryReady();

    const folder = this.mediaFolder();
    const filename =
      validated.originalname?.trim() || 'file';

    const uploadOptions: {
      resource_type: 'image' | 'video';
      folder: string;
      upload_preset?: string;
    } = {
      resource_type: resourceType,
      folder,
    };
    if (uploadPreset) {
      uploadOptions.upload_preset = uploadPreset;
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, uploaded) => {
          if (error) {
            reject(error);
            return;
          }

          if (!uploaded) {
            reject(new Error('Cloudinary returned no upload result'));
            return;
          }

          resolve(uploaded);
        },
      );

      stream.end(validated.buffer);
    }).catch((error) => {
      throw new BadRequestException(
        this.reportCloudinaryFailure(error, 'upload', filename),
      );
    });

    const storedFilename =
      validated.originalname?.trim() ||
      filenameFromPublicId(result.public_id, result.format);
    const altText =
      alt.trim().slice(0, 500) || storedFilename.replace(/\.[^.]+$/, '');

    await this.prisma.mediaAsset.upsert({
      where: { publicId: result.public_id },
      create: {
        publicId: result.public_id,
        url: result.secure_url,
        filename: storedFilename,
        alt: altText,
        mimeType:
          validated.mimetype ||
          mimeFromFormat(result.resource_type, result.format),
        sizeBytes: result.bytes ?? null,
        uploadedAt: new Date(),
      },
      update: {
        url: result.secure_url,
        filename: storedFilename,
        alt: altText,
        mimeType:
          validated.mimetype ||
          mimeFromFormat(result.resource_type, result.format),
        sizeBytes: result.bytes ?? null,
        uploadedAt: new Date(),
      },
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      filename: storedFilename,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      duration: result.duration ?? undefined,
    };
  }

  async uploadMany(files: Express.Multer.File[], alt = '') {
    if (!files?.length) {
      throw new BadRequestException('At least one media file is required');
    }

    if (files.length > MEDIA_UPLOAD_MAX_FILES) {
      throw new BadRequestException(
        `You can upload at most ${MEDIA_UPLOAD_MAX_FILES} files at a time`,
      );
    }

    // Ensure Cloudinary is configured before starting any uploads.
    this.assertCloudinaryReady();

    const uploaded: Awaited<ReturnType<MediaService['upload']>>[] = [];
    const failed: { filename: string; message: string }[] = [];

    for (const file of files) {
      const filename = file.originalname?.trim() || 'file';
      try {
        uploaded.push(await this.upload(file, alt));
      } catch (error) {
        failed.push({
          filename,
          message: messageFromUploadError(error),
        });
      }
    }

    if (uploaded.length === 0) {
      throw new BadRequestException(
        failed.length === 1
          ? failed[0].message
          : `All uploads failed: ${failed.map((item) => `${item.filename}: ${item.message}`).join('; ')}`,
      );
    }

    return { uploaded, failed };
  }

  async delete(
    publicId: string,
    resourceType: MediaResourceType | string = 'image',
  ) {
    const id = publicId?.trim();

    if (!id) {
      throw new BadRequestException('publicId is required');
    }

    const type: MediaResourceType =
      resourceType === 'video' ? 'video' : 'image';

    this.assertCloudinaryReady();

    const result = await cloudinary.uploader
      .destroy(id, { resource_type: type })
      .catch((error: unknown) => {
        throw new BadRequestException(
          this.reportCloudinaryFailure(error, 'delete', id),
        );
      });

    if (result.result === 'not found' && type === 'image') {
      const videoResult = await cloudinary.uploader
        .destroy(id, { resource_type: 'video' })
        .catch((error: unknown) => {
          throw new BadRequestException(
            this.reportCloudinaryFailure(error, 'delete', id),
          );
        });

      if (videoResult.result === 'ok') {
        await this.removeRecord(id);
        return {
          publicId: id,
          deleted: true,
          resourceType: 'video' as const,
        };
      }
    }

    if (result.result === 'not found') {
      const removed = await this.prisma.mediaAsset.deleteMany({
        where: { publicId: id },
      });
      if (removed.count > 0) {
        return {
          publicId: id,
          deleted: true,
          resourceType: type,
        };
      }

      throw new NotFoundException(`Media not found: ${id}`);
    }

    if (result.result !== 'ok') {
      throw new BadRequestException(
        `Cloudinary delete failed: ${result.result ?? 'unknown'}`,
      );
    }

    await this.removeRecord(id);

    return {
      publicId: id,
      deleted: true,
      resourceType: type,
    };
  }

  private toRecord(row: MediaAsset) {
    return {
      publicId: row.publicId,
      url: row.url,
      filename: row.filename,
      alt: row.alt,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }

  private async removeRecord(publicId: string) {
    await this.prisma.mediaAsset.deleteMany({ where: { publicId } });
  }

  /** Pull Cloudinary files that were uploaded before the library table existed. */
  private syncFromCloudinary(): Promise<void> {
    if (Date.now() - this.lastCloudinarySyncAt < CLOUDINARY_SYNC_INTERVAL_MS) {
      return Promise.resolve();
    }

    if (!this.cloudinarySync) {
      this.cloudinarySync = this.importMissingCloudinaryAssets()
        .then(() => {
          this.lastCloudinarySyncAt = Date.now();
        })
        .finally(() => {
          this.cloudinarySync = null;
        });
    }

    return this.cloudinarySync;
  }

  private async importMissingCloudinaryAssets() {
    this.assertCloudinaryReady();
    const prefix = this.mediaFolder();
    const resources = [
      ...(await this.listCloudinaryResources('image', prefix)),
      ...(await this.listCloudinaryResources('video', prefix)),
    ];
    const rows = resources
      .map((resource) => toImportRow(resource))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) return;

    await this.prisma.mediaAsset.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  private async listCloudinaryResources(
    resourceType: 'image' | 'video',
    prefix: string,
  ) {
    const collected: CloudinaryResource[] = [];
    let nextCursor: string | undefined;

    for (let page = 0; page < 20; page += 1) {
      const result = (await cloudinary.api.resources({
        type: 'upload',
        resource_type: resourceType,
        prefix,
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      })) as CloudinaryListResult;

      collected.push(...(result.resources ?? []));
      nextCursor = result.next_cursor;
      if (!nextCursor) break;
    }

    return collected;
  }
}

function messageFromUploadError(error: unknown): string {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (Array.isArray(record.message)) {
        return record.message.map(String).join('; ');
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Upload failed';
}

export type CloudinaryErrorDetails = {
  message: string;
  name?: string;
  httpCode?: number;
  errorCode?: string;
};

/** Extract Cloudinary SDK / API error fields without logging secrets. */
export function extractCloudinaryErrorDetails(
  error: unknown,
): CloudinaryErrorDetails {
  if (error == null) {
    return { message: 'Unknown Cloudinary error' };
  }

  if (typeof error === 'string') {
    return { message: sanitizeCloudinaryMessage(error) };
  }

  if (typeof error !== 'object') {
    return { message: 'Unknown Cloudinary error' };
  }

  const record = error as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : undefined;

  const rawMessage =
    firstString(record.message) ||
    firstString(nested?.message) ||
    (error instanceof Error ? error.message : '') ||
    'Cloudinary request failed';

  const name = firstString(record.name) || firstString(nested?.name);
  const httpCode = firstNumber(record.http_code) ?? firstNumber(nested?.http_code);
  const errorCode = firstStringOrNumber(
    record.error_code ??
      record.code ??
      nested?.error_code ??
      nested?.code,
  );

  return {
    message: sanitizeCloudinaryMessage(rawMessage),
    name: name ? sanitizeCloudinaryMessage(name) : undefined,
    httpCode,
    errorCode: errorCode
      ? sanitizeCloudinaryMessage(String(errorCode))
      : undefined,
  };
}

/**
 * Map Cloudinary failures to actionable client copy.
 * Preserves useful Cloudinary messages; never returns credentials/signatures.
 */
export function toSafeCloudinaryClientMessage(
  details: CloudinaryErrorDetails,
  operation: 'upload' | 'delete' = 'upload',
): string {
  const message = details.message;
  const lower = message.toLowerCase();
  const verb = operation === 'delete' ? 'delete' : 'upload';

  if (
    details.httpCode === 401 ||
    details.httpCode === 403 ||
    /invalid (api[_ ]?key|signature|credentials)|unauthorized|not allowed|forbidden/i.test(
      message,
    )
  ) {
    return `Cloudinary ${verb} failed: invalid credentials. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET for this cloud.`;
  }

  if (
    /upload[_\s-]?preset|unknown preset|preset must be|must supply upload preset/i.test(
      message,
    )
  ) {
    return `Cloudinary ${verb} failed: invalid or incompatible upload preset. Use a signed preset that exists on this cloud, or leave CLOUDINARY_UPLOAD_PRESET empty for server-side signed uploads.`;
  }

  if (/folder|asset_folder|invalid path/i.test(lower)) {
    return `Cloudinary ${verb} failed: folder configuration rejected (${message}). Check CLOUDINARY_FOLDER for this cloud.`;
  }

  if (details.httpCode === 404 || /cloud[_ ]?name/i.test(message)) {
    return `Cloudinary ${verb} failed: cloud or resource not found. Verify CLOUDINARY_CLOUD_NAME.`;
  }

  if (message && message !== 'Cloudinary request failed') {
    return `Cloudinary ${verb} failed: ${message}`;
  }

  return `Cloudinary ${verb} failed`;
}

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function firstNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function firstStringOrNumber(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Strip credential-like tokens from messages before logging or client return. */
function sanitizeCloudinaryMessage(message: string): string {
  return message
    .replace(
      /(api[_-]?secret|api[_-]?key|signature|token|authorization|password)\s*[:=]\s*['"]?[^'",\s]+/gi,
      '$1=[redacted]',
    )
    .slice(0, 500);
}

function filenameFromPublicId(publicId: string, format?: string) {
  const tail = publicId.split('/').pop() || publicId;
  return format ? `${tail}.${format}` : tail;
}

function mimeFromFormat(resourceType: string, format?: string) {
  const normalized = (format || '').toLowerCase();
  if (resourceType === 'video') {
    if (normalized === 'webm') return 'video/webm';
    if (normalized === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }
  if (normalized === 'png') return 'image/png';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function filenameFor(resource: CloudinaryResource) {
  const format = (resource.format || '').toLowerCase();
  const original = resource.original_filename?.trim();
  if (original) return format ? `${original}.${format}` : original;
  return filenameFromPublicId(resource.public_id || 'media', format);
}

function toImportRow(resource: CloudinaryResource) {
  const publicId = resource.public_id?.trim() ?? '';
  const url = resource.secure_url || resource.url || '';
  if (!publicId || !url) return null;

  const resourceType = resource.resource_type === 'video' ? 'video' : 'image';
  const uploadedAt = resource.created_at
    ? new Date(resource.created_at)
    : new Date();

  return {
    publicId,
    url,
    filename: filenameFor(resource),
    alt: '',
    mimeType: mimeFromFormat(resourceType, resource.format),
    sizeBytes: typeof resource.bytes === 'number' ? resource.bytes : null,
    uploadedAt: Number.isNaN(uploadedAt.getTime()) ? new Date() : uploadedAt,
  };
}

/** Multer absolute ceiling (video max). Per-type limits enforced after upload. */
export const MEDIA_UPLOAD_LIMIT_BYTES = MAX_VIDEO_BYTES;

/** Max files accepted by POST /v1/media/upload-batch. */
export const MEDIA_UPLOAD_MAX_FILES = 20;
