import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassThrough } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractCloudinaryErrorDetails,
  MediaService,
  toSafeCloudinaryClientMessage,
} from './media.service';

jest.mock('cloudinary', () => {
  const upload_stream = jest.fn();
  const destroy = jest.fn();
  const resources = jest.fn();
  const config = jest.fn();
  return {
    v2: {
      config,
      uploader: { upload_stream, destroy },
      api: { resources },
    },
  };
});

import { v2 as cloudinary } from 'cloudinary';

const uploadStreamMock = cloudinary.uploader.upload_stream as jest.Mock;
const destroyMock = cloudinary.uploader.destroy as jest.Mock;

/** Minimal valid 1x1 PNG for file-type sniffing. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function pngFile(name = '1.png'): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/png',
    size: PNG_1X1.length,
    buffer: PNG_1X1,
    destination: '',
    filename: name,
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
  };
}

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function mockPrisma() {
  return {
    mediaAsset: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaService;
}

function mockUploadStreamResult(
  error: unknown,
  result?: Record<string, unknown>,
) {
  uploadStreamMock.mockImplementation((_options, callback) => {
    const stream = new PassThrough();
    setImmediate(() => callback(error, result));
    return stream;
  });
}

describe('extractCloudinaryErrorDetails / toSafeCloudinaryClientMessage', () => {
  it('reads plain UploadApiErrorResponse objects (not Error instances)', () => {
    const details = extractCloudinaryErrorDetails({
      message: 'Invalid Signature',
      name: 'Error',
      http_code: 401,
    });
    expect(details).toEqual({
      message: 'Invalid Signature',
      name: 'Error',
      httpCode: 401,
      errorCode: undefined,
    });
    expect(toSafeCloudinaryClientMessage(details)).toContain(
      'invalid credentials',
    );
  });

  it('maps upload preset failures to actionable guidance', () => {
    const details = extractCloudinaryErrorDetails({
      message: 'Upload preset must be specified when using unsigned upload',
      name: 'Error',
      http_code: 400,
    });
    expect(toSafeCloudinaryClientMessage(details)).toContain('upload preset');
  });

  it('maps folder failures without claiming credentials', () => {
    const details = extractCloudinaryErrorDetails({
      message: 'Invalid folder path',
      http_code: 400,
    });
    expect(toSafeCloudinaryClientMessage(details)).toContain(
      'CLOUDINARY_FOLDER',
    );
  });

  it('redacts credential assignments in messages', () => {
    const details = extractCloudinaryErrorDetails({
      message: 'Bad request api_secret=supersecretvalue signature=abc123',
    });
    expect(details.message).toContain('[redacted]');
    expect(details.message).not.toContain('supersecretvalue');
  });
});

describe('MediaService Cloudinary uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when Cloudinary credentials are missing', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: '',
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: '',
      }),
      mockPrisma(),
    );

    await expect(service.upload(pngFile())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns actionable error for invalid credentials (401 plain object)', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        CLOUDINARY_FOLDER: 'babypleats',
      }),
      mockPrisma(),
    );

    mockUploadStreamResult({
      message: 'Invalid Signature',
      name: 'Error',
      http_code: 401,
    });

    await expect(service.upload(pngFile('11.png'))).rejects.toThrow(
      /invalid credentials/i,
    );
  });

  it('returns actionable error for invalid upload preset', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        CLOUDINARY_UPLOAD_PRESET: 'missing_preset',
        CLOUDINARY_FOLDER: 'babypleats',
      }),
      mockPrisma(),
    );

    mockUploadStreamResult({
      message: 'Unknown upload preset missing_preset',
      name: 'Error',
      http_code: 400,
      error_code: 'upload_preset',
    });

    await expect(service.upload(pngFile())).rejects.toThrow(/upload preset/i);
    expect(uploadStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_preset: 'missing_preset',
        folder: 'babypleats',
      }),
      expect.any(Function),
    );
  });

  it('returns actionable error for folder rejection', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        CLOUDINARY_FOLDER: 'not/allowed',
      }),
      mockPrisma(),
    );

    mockUploadStreamResult({
      message: 'Invalid folder',
      name: 'Error',
      http_code: 400,
    });

    await expect(service.upload(pngFile())).rejects.toThrow(
      /folder configuration rejected/i,
    );
  });

  it('uploads successfully without upload_preset (signed server upload)', async () => {
    const prisma = mockPrisma();
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        CLOUDINARY_FOLDER: 'babypleats',
      }),
      prisma,
    );

    mockUploadStreamResult(undefined, {
      public_id: 'babypleats/abc',
      secure_url: 'https://res.cloudinary.com/mdqbllsu/image/upload/babypleats/abc.png',
      resource_type: 'image',
      format: 'png',
      bytes: PNG_1X1.length,
      width: 1,
      height: 1,
    });

    const result = await service.upload(pngFile('product.png'), 'alt text');

    expect(result.publicId).toBe('babypleats/abc');
    expect(result.filename).toBe('product.png');
    expect(uploadStreamMock).toHaveBeenCalledWith(
      {
        resource_type: 'image',
        folder: 'babypleats',
      },
      expect.any(Function),
    );
    expect(prisma.mediaAsset.upsert).toHaveBeenCalled();
  });

  it('surfaces Cloudinary plain-object errors in uploadMany instead of generic fallback', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
        CLOUDINARY_FOLDER: 'babypleats',
      }),
      mockPrisma(),
    );

    mockUploadStreamResult({
      message: 'Invalid Signature',
      name: 'Error',
      http_code: 401,
    });

    try {
      await service.uploadMany([pngFile('11.png'), pngFile('1.png')]);
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const message = (error as BadRequestException).message;
      expect(message).toContain('11.png');
      expect(message).toContain('1.png');
      expect(message).toMatch(/invalid credentials/i);
      expect(message).not.toBe(
        'All uploads failed: 11.png: Cloudinary upload failed; 1.png: Cloudinary upload failed.',
      );
    }
  });

  it('does not require CLOUDINARY_UPLOAD_PRESET when credentials are present', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
      mockPrisma(),
    );

    mockUploadStreamResult(undefined, {
      public_id: 'babypleats/ok',
      secure_url: 'https://res.cloudinary.com/mdqbllsu/image/upload/ok.png',
      resource_type: 'image',
      format: 'png',
      bytes: 10,
    });

    await expect(service.upload(pngFile())).resolves.toMatchObject({
      publicId: 'babypleats/ok',
    });
  });
});

describe('MediaService delete Cloudinary errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps credential failures on delete', async () => {
    const service = new MediaService(
      mockConfig({
        CLOUDINARY_CLOUD_NAME: 'mdqbllsu',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
      mockPrisma(),
    );

    destroyMock.mockRejectedValue({
      message: 'Invalid API Key',
      name: 'Error',
      http_code: 401,
    });

    await expect(service.delete('babypleats/x')).rejects.toThrow(
      /invalid credentials/i,
    );
  });
});
