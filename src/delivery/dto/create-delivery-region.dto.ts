import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'regionTransitRange', async: false })
class RegionTransitRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as {
      transitMinDays?: number;
      transitMaxDays?: number;
    };
    if (
      typeof obj.transitMinDays !== 'number' ||
      typeof obj.transitMaxDays !== 'number'
    ) {
      return true;
    }
    return obj.transitMinDays <= obj.transitMaxDays;
  }

  defaultMessage(): string {
    return 'transitMinDays must not exceed transitMaxDays';
  }
}

export class CreateDeliveryRegionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^\d{1,5}$/, {
    each: true,
    message: 'each pincode prefix must be 1–5 digits',
  })
  pincodePrefixes!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  @Validate(RegionTransitRangeConstraint)
  transitMinDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  transitMaxDays!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
