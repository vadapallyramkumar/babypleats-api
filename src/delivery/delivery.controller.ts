import {
  Body,
  Controller,
  Delete,
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
import { CreateDeliveryHolidayDto } from './dto/create-delivery-holiday.dto';
import { CreateDeliveryRegionDto } from './dto/create-delivery-region.dto';
import { DeliveryEstimateDto } from './dto/delivery-estimate.dto';
import { UpdateDeliverySettingsDto } from './dto/delivery-settings.dto';
import { UpdateDeliveryHolidayDto } from './dto/update-delivery-holiday.dto';
import { UpdateDeliveryRegionDto } from './dto/update-delivery-region.dto';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('estimate')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async estimate(@Body() body: DeliveryEstimateDto) {
    const data = await this.delivery.estimate(body);
    return { data };
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getSettings() {
    const data = await this.delivery.getSettings();
    return { data };
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  async patchSettings(@Body() body: UpdateDeliverySettingsDto) {
    const data = await this.delivery.updateSettings(body);
    return { data };
  }

  @Get('regions')
  @UseGuards(JwtAuthGuard)
  async listRegions() {
    const data = await this.delivery.listRegions();
    return { data };
  }

  @Post('regions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createRegion(@Body() body: CreateDeliveryRegionDto) {
    const data = await this.delivery.createRegion(body);
    return { data };
  }

  @Get('regions/:id')
  @UseGuards(JwtAuthGuard)
  async getRegion(@Param('id') id: string) {
    const data = await this.delivery.getRegion(id);
    return { data };
  }

  @Patch('regions/:id')
  @UseGuards(JwtAuthGuard)
  async patchRegion(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryRegionDto,
  ) {
    const data = await this.delivery.updateRegion(id, body);
    return { data };
  }

  @Delete('regions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async removeRegion(@Param('id') id: string) {
    await this.delivery.removeRegion(id);
  }

  @Get('holidays')
  @UseGuards(JwtAuthGuard)
  async listHolidays(@Query('year') year?: string) {
    const data = await this.delivery.listHolidays(
      year !== undefined && year !== '' ? Number(year) : undefined,
    );
    return { data };
  }

  @Post('holidays')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createHoliday(@Body() body: CreateDeliveryHolidayDto) {
    const data = await this.delivery.createHoliday(body);
    return { data };
  }

  @Patch('holidays/:id')
  @UseGuards(JwtAuthGuard)
  async patchHoliday(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryHolidayDto,
  ) {
    const data = await this.delivery.updateHoliday(id, body);
    return { data };
  }

  @Delete('holidays/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async removeHoliday(@Param('id') id: string) {
    await this.delivery.removeHoliday(id);
  }
}
