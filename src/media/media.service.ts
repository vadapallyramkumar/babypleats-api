import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {
    this.configureCloudinary();
  }

  private configureCloudinary() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();

    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();

    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();

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

  async uploadImage(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only image files are supported');
    }

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();

    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();

    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();

    const uploadPreset = this.config
      .get<string>('CLOUDINARY_UPLOAD_PRESET')
      ?.trim();

    if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
      throw new ServiceUnavailableException(
        'Cloudinary upload is not configured',
      );
    }

    this.configureCloudinary();

    const folder =
      this.config.get<string>('CLOUDINARY_FOLDER')?.trim() ||
      'babypleates/products';

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
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
    };
  }
}
