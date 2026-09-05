import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

type MediaResourceType = 'image' | 'video';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {
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

  private resolveResourceType(mimetype: string): MediaResourceType {
    if (mimetype.startsWith('image/')) {
      return 'image';
    }

    if (mimetype.startsWith('video/')) {
      return 'video';
    }

    throw new BadRequestException('Only image and video files are supported');
  }

  async upload(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Media file is required');
    }

    const resourceType = this.resolveResourceType(file.mimetype ?? '');
    const { uploadPreset } = this.assertCloudinaryReady(true);

    const folder =
      this.config.get<string>('CLOUDINARY_FOLDER')?.trim() ||
      'babypleates/products';

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

      stream.end(file.buffer);
    }).catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Cloudinary upload failed';

      throw new BadRequestException(message);
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
        return {
          publicId: id,
          deleted: true,
          resourceType: 'video' as const,
        };
      }
    }

    if (result.result === 'not found') {
      throw new NotFoundException(`Media not found: ${id}`);
    }

    if (result.result !== 'ok') {
      throw new BadRequestException(
        `Cloudinary delete failed: ${result.result ?? 'unknown'}`,
      );
    }

    return {
      publicId: id,
      deleted: true,
      resourceType: type,
    };
  }

}
