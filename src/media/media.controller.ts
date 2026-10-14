import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeleteMediaDto } from './dto/delete-media.dto';
import {
  MEDIA_UPLOAD_LIMIT_BYTES,
  MEDIA_UPLOAD_MAX_FILES,
  MediaService,
} from './media.service';
import { ALLOWED_MEDIA_MIME_TYPES } from './media.validation';

function mediaFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const mime = (file.mimetype || '').toLowerCase();
  if (!(ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mime)) {
    cb(
      new BadRequestException(
        `Unsupported media type "${mime || 'unknown'}". Allowed: ${ALLOWED_MEDIA_MIME_TYPES.join(', ')}`,
      ) as unknown as Error,
      false,
    );
    return;
  }
  cb(null, true);
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list() {
    const data = await this.media.list();
    return { data };
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MEDIA_UPLOAD_LIMIT_BYTES, files: 1 },
      fileFilter: mediaFileFilter,
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt?: string,
  ) {
    const data = await this.media.upload(
      file,
      typeof alt === 'string' ? alt : '',
    );

    return {
      data,
    };
  }

  @Post('upload-batch')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', MEDIA_UPLOAD_MAX_FILES, {
      storage: memoryStorage(),
      limits: {
        fileSize: MEDIA_UPLOAD_LIMIT_BYTES,
        files: MEDIA_UPLOAD_MAX_FILES,
      },
      fileFilter: mediaFileFilter,
    }),
  )
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('alt') alt?: string,
  ) {
    const data = await this.media.uploadMany(
      files ?? [],
      typeof alt === 'string' ? alt : '',
    );

    return {
      data,
    };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async delete(@Body() body: DeleteMediaDto) {
    const data = await this.media.delete(
      body.publicId,
      body.resourceType ?? 'image',
    );

    return {
      data,
    };
  }
}
