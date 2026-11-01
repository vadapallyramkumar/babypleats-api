import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryHolidayDto } from './create-delivery-holiday.dto';

export class UpdateDeliveryHolidayDto extends PartialType(
  CreateDeliveryHolidayDto,
) {}
