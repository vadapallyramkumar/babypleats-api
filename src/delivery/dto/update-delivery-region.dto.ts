import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryRegionDto } from './create-delivery-region.dto';

export class UpdateDeliveryRegionDto extends PartialType(
  CreateDeliveryRegionDto,
) {}
