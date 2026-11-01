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
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isIanaTimezone', async: false })
export class IsIanaTimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value.trim() });
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone';
  }
}

@ValidatorConstraint({ name: 'minNotGreaterThanMax', async: false })
export class MinNotGreaterThanMaxConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>;
    const [minKey, maxKey] = args.constraints as [string, string];
    const min = obj[minKey];
    const max = obj[maxKey];
    if (typeof min !== 'number' || typeof max !== 'number') return true;
    return min <= max;
  }

  defaultMessage(args: ValidationArguments): string {
    const [minKey, maxKey] = args.constraints as [string, string];
    return `${minKey} must not exceed ${maxKey}`;
  }
}

export class UpdateDeliverySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  @Validate(MinNotGreaterThanMaxConstraint, [
    'preparationMinDays',
    'preparationMaxDays',
  ])
  preparationMinDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  preparationMaxDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  @Validate(MinNotGreaterThanMaxConstraint, [
    'defaultTransitMinDays',
    'defaultTransitMaxDays',
  ])
  defaultTransitMinDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  defaultTransitMaxDays?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'cutoffTime must be HH:mm (24-hour)',
  })
  cutoffTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Validate(IsIanaTimezoneConstraint)
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'workingDays must not be empty' })
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingDays?: number[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
