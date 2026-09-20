import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RazorpayService } from './razorpay.service';

@Module({
  imports: [AuthModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService, RazorpayService],
  exports: [OrdersService],
})
export class OrdersModule {}
