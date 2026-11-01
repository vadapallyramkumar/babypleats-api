import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateDeliveryHolidayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
