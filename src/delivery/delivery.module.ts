import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliveryCalculatorService } from './delivery-calculator.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [AuthModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryCalculatorService],
  exports: [DeliveryService, DeliveryCalculatorService],
})
export class DeliveryModule {}
