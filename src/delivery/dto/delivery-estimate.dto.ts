import { IsString, Matches } from 'class-validator';

export class DeliveryEstimateDto {
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'pincode must be exactly 6 digits',
  })
  pincode!: string;
}
