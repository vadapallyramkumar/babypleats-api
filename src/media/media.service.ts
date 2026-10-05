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

  private assertCloudinaryReady(requireUploadPreset = false) {
    const { cloudName, apiKey, apiSecret, uploadPreset } =
      this.getCloudinaryCredentials();

    if (
      !cloudName ||
      !apiKey ||
      !apiSecret ||
      (requireUploadPreset && !uploadPreset)
    ) {
      throw new ServiceUnavailableException('Cloudinary is not configured');
    }

    this.configureCloudinary();

    return { uploadPreset: uploadPreset! };
  }

  private mediaFolder() {
    return (
      this.config.get<string>('CLOUDINARY_FOLDER')?.trim() ||
      'babypleates/products'
    );
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
    const { uploadPreset } = this.assertCloudinaryReady(true);

    const folder = this.mediaFolder();

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          upload_preset: uploadPreset,
          folder,
        },
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
      const message =
        error instanceof Error ? error.message : 'Cloudinary upload failed';

      throw new BadRequestException(message);
    });

    const filename =
      validated.originalname?.trim() ||
      filenameFromPublicId(result.public_id, result.format);
    const altText =
      alt.trim().slice(0, 500) || filename.replace(/\.[^.]+$/, '');

    await this.prisma.mediaAsset.upsert({
      where: { publicId: result.public_id },
      create: {
        publicId: result.public_id,
        url: result.secure_url,
        filename,
        alt: altText,
        mimeType:
          validated.mimetype ||
          mimeFromFormat(result.resource_type, result.format),
        sizeBytes: result.bytes ?? null,
        uploadedAt: new Date(),
      },
      update: {
        url: result.secure_url,
        filename,
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
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      duration: result.duration ?? undefined,
    };
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

    this.assertCloudinaryReady(false);

    const result = await cloudinary.uploader
      .destroy(id, { resource_type: type })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Cloudinary delete failed';

        throw new BadRequestException(message);
      });

    if (result.result === 'not found' && type === 'image') {
      const videoResult = await cloudinary.uploader
        .destroy(id, { resource_type: 'video' })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Cloudinary delete failed';

          throw new BadRequestException(message);
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
    this.assertCloudinaryReady(false);
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
