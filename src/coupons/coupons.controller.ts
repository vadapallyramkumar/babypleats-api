import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CouponsService } from './coupons.service';

@Controller()
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('coupons/validate')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validate(@Body() body: ValidateCouponDto) {
    const data = await this.coupons.validatePublic(body);
    return { data };
  }

  @Get('coupons')
  @UseGuards(JwtAuthGuard)
  async list() {
    const data = await this.coupons.list();
    return { data };
  }

  @Post('coupons')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async create(@Body() body: CreateCouponDto) {
    const data = await this.coupons.create(body);
    return { data };
  }

  @Get('coupons/:id')
  @UseGuards(JwtAuthGuard)
  async get(@Param('id') id: string) {
    const data = await this.coupons.getById(id);
    return { data };
  }

  @Patch('coupons/:id')
  @UseGuards(JwtAuthGuard)
  async patch(@Param('id') id: string, @Body() body: UpdateCouponDto) {
    const data = await this.coupons.update(id, body);
    return { data };
  }

  @Delete('coupons/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.coupons.remove(id);
  }
}
