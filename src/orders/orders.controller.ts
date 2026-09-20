import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkout(@Body() body: CheckoutDto) {
    const data = await this.orders.checkout(body);
    return { data };
  }

  @Post('orders')
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkoutAlias(@Body() body: CheckoutDto) {
    const data = await this.orders.checkout(body);
    return { data };
  }

  @Post('checkout/verify')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verify(@Body() body: VerifyPaymentDto) {
    const data = await this.orders.verifyPayment(body);
    return { data };
  }

  @Post('payments/verify')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyPaymentsAlias(@Body() body: VerifyPaymentDto) {
    const data = await this.orders.verifyPayment(body);
    return { data };
  }

  @Post('orders/:id/payments/verify')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyOrderAlias(
    @Param('id') id: string,
    @Body() body: VerifyPaymentDto,
  ) {
    const data = await this.orders.verifyPayment({
      ...body,
      orderId: body.orderId || id,
    });
    return { data };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async list(
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.list({
      status,
      paymentMethod,
      from,
      to,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async get(@Param('id') id: string) {
    const data = await this.orders.getById(id);
    return { data };
  }

  @Patch('orders/:id')
  @UseGuards(JwtAuthGuard)
  async patch(@Param('id') id: string, @Body() body: UpdateOrderDto) {
    const data = await this.orders.update(id, body);
    return { data };
  }

  @Get('dashboard/sales')
  @UseGuards(JwtAuthGuard)
  async sales(@Query('range') range?: string) {
    const data = await this.orders.salesDashboard(range);
    return { data };
  }
}
