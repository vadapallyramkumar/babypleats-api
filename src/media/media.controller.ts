import {
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const data = await this.media.uploadImage(file);

    return {
      data,
    };
  }

  @Delete()
  @UseGuards(ApiKeyGuard)
  async deleteImage(@Body() body: { publicId?: string }) {
    const data = await this.media.deleteImage(body?.publicId ?? '');

    return {
      data,
    };
  }
}
