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

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const data = await this.media.upload(file);

    return {
      data,
    };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async delete(
    @Body() body: { publicId?: string; resourceType?: 'image' | 'video' },
  ) {
    const data = await this.media.delete(
      body?.publicId ?? '',
      body?.resourceType ?? 'image',
    );

    return {
      data,
    };
  }
}
