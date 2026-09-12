import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateHeroImageDto,
  CreatePromotionalMessageDto,
  CreateSocialLinkDto,
  UpdateHeroImageDto,
  UpdatePromotionalMessageDto,
  UpdateSocialLinkDto,
} from './dto/home-write.dto';
import { HomeService } from './home.service';

function parseBool(v?: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

function ok<T>(data: T, message: string) {
  return { success: true as const, data, message };
}

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  // --- Hero images ---

  @Get('hero-images')
  async listHeroImages(@Query('includeInactive') includeInactive?: string) {
    const data = await this.home.listHeroImages({
      includeInactive: parseBool(includeInactive) === true,
    });
    return ok(data, 'Hero images fetched successfully');
  }

  @Get('hero-images/:id')
  async getHeroImage(@Param('id') id: string) {
    const data = await this.home.getHeroImage(id);
    return ok(data, 'Hero image fetched successfully');
  }

  @Post('hero-images')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createHeroImage(@Body() body: CreateHeroImageDto) {
    const data = await this.home.createHeroImage(body);
    return ok(data, 'Hero image created successfully');
  }

  @Patch('hero-images/:id')
  @UseGuards(JwtAuthGuard)
  async patchHeroImage(
    @Param('id') id: string,
    @Body() body: UpdateHeroImageDto,
  ) {
    const data = await this.home.updateHeroImage(id, body);
    return ok(data, 'Hero image updated successfully');
  }

  @Put('hero-images/:id')
  @UseGuards(JwtAuthGuard)
  async putHeroImage(
    @Param('id') id: string,
    @Body() body: UpdateHeroImageDto,
  ) {
    const data = await this.home.updateHeroImage(id, body);
    return ok(data, 'Hero image updated successfully');
  }

  @Delete('hero-images/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteHeroImage(@Param('id') id: string) {
    await this.home.deleteHeroImage(id);
  }

  // --- Promotional messages ---

  @Get('promotional-messages')
  async listPromotionalMessages(
    @Query('includeInactive') includeInactive?: string,
  ) {
    const data = await this.home.listPromotionalMessages({
      includeInactive: parseBool(includeInactive) === true,
    });
    return ok(data, 'Promotional messages fetched successfully');
  }

  @Get('promotional-messages/:id')
  async getPromotionalMessage(@Param('id') id: string) {
    const data = await this.home.getPromotionalMessage(id);
    return ok(data, 'Promotional message fetched successfully');
  }

  @Post('promotional-messages')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createPromotionalMessage(@Body() body: CreatePromotionalMessageDto) {
    const data = await this.home.createPromotionalMessage(body);
    return ok(data, 'Promotional message created successfully');
  }

  @Patch('promotional-messages/:id')
  @UseGuards(JwtAuthGuard)
  async patchPromotionalMessage(
    @Param('id') id: string,
    @Body() body: UpdatePromotionalMessageDto,
  ) {
    const data = await this.home.updatePromotionalMessage(id, body);
    return ok(data, 'Promotional message updated successfully');
  }

  @Put('promotional-messages/:id')
  @UseGuards(JwtAuthGuard)
  async putPromotionalMessage(
    @Param('id') id: string,
    @Body() body: UpdatePromotionalMessageDto,
  ) {
    const data = await this.home.updatePromotionalMessage(id, body);
    return ok(data, 'Promotional message updated successfully');
  }

  @Delete('promotional-messages/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deletePromotionalMessage(@Param('id') id: string) {
    await this.home.deletePromotionalMessage(id);
  }

  // --- Social links ---

  @Get('social-links')
  async listSocialLinks(@Query('includeInactive') includeInactive?: string) {
    const data = await this.home.listSocialLinks({
      includeInactive: parseBool(includeInactive) === true,
    });
    return ok(data, 'Social links fetched successfully');
  }

  @Get('social-links/:id')
  async getSocialLink(@Param('id') id: string) {
    const data = await this.home.getSocialLink(id);
    return ok(data, 'Social link fetched successfully');
  }

  @Post('social-links')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createSocialLink(@Body() body: CreateSocialLinkDto) {
    const data = await this.home.createSocialLink(body);
    return ok(data, 'Social link created successfully');
  }

  @Patch('social-links/:id')
  @UseGuards(JwtAuthGuard)
  async patchSocialLink(
    @Param('id') id: string,
    @Body() body: UpdateSocialLinkDto,
  ) {
    const data = await this.home.updateSocialLink(id, body);
    return ok(data, 'Social link updated successfully');
  }

  @Put('social-links/:id')
  @UseGuards(JwtAuthGuard)
  async putSocialLink(
    @Param('id') id: string,
    @Body() body: UpdateSocialLinkDto,
  ) {
    const data = await this.home.updateSocialLink(id, body);
    return ok(data, 'Social link updated successfully');
  }

  @Delete('social-links/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteSocialLink(@Param('id') id: string) {
    await this.home.deleteSocialLink(id);
  }
}
