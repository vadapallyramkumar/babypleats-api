import { PartialType } from '@nestjs/mapped-types';
import { SocialMediaType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateHeroImageDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  mobileUrl?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  alt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateHeroImageDto extends PartialType(CreateHeroImageDto) {}

export class CreatePromotionalMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePromotionalMessageDto extends PartialType(
  CreatePromotionalMessageDto,
) {}

export class CreateSocialLinkDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsEnum(SocialMediaType)
  type!: SocialMediaType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSocialLinkDto extends PartialType(CreateSocialLinkDto) {}
