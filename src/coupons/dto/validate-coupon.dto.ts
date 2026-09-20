import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CheckoutItemDto } from '../../orders/dto/checkout.dto';

export class ValidateCouponDto {
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
