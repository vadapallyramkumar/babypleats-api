import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  orderId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  razorpay_payment_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  razorpay_order_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  razorpay_signature!: string;
}
