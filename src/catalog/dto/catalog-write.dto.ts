import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORY_FILTERS = ['budgetFriendly', 'readyToDispatch', 'bestseller'] as const;

export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id?: string;

  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (e.g. my-category)',
  })
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  image!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsIn([...CATEGORY_FILTERS])
  filter?: (typeof CATEGORY_FILTERS)[number] | null;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class VariantPriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  selling!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  original?: number;

  @IsIn(['INR'])
  currency!: 'INR';
}

export class VariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  size!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  color!: string;

  @ValidateNested()
  @Type(() => VariantPriceDto)
  price!: VariantPriceDto;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  image?: string;
}

export class ColorGalleryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  color!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { each: true },
  )
  images!: string[];
}

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id?: string;

  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (e.g. my-product)',
  })
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  categoryId!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @MaxLength(120)
  subcategory?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  description!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @MaxLength(500)
  fabric?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  care?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { each: true },
  )
  images!: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorGalleryDto)
  colorGalleries?: ColorGalleryDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reviewsCount?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tags?: string[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
