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
import { ApiKeyGuard } from '../auth/api-key.guard';
import { HomeService } from './home.service';
import type {
  HeroImageWriteBody,
  PromotionalMessageWriteBody,
  SocialLinkWriteBody,
} from './home.service';

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
  @UseGuards(ApiKeyGuard)
  @HttpCode(201)
  async createHeroImage(@Body() body: HeroImageWriteBody) {
    const data = await this.home.createHeroImage(body);
    return ok(data, 'Hero image created successfully');
  }

  @Patch('hero-images/:id')
  @UseGuards(ApiKeyGuard)
  async patchHeroImage(
    @Param('id') id: string,
    @Body() body: Partial<HeroImageWriteBody>,
  ) {
    const data = await this.home.updateHeroImage(id, body);
    return ok(data, 'Hero image updated successfully');
  }

  @Delete('hero-images/:id')
  @UseGuards(ApiKeyGuard)
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
  @UseGuards(ApiKeyGuard)
  @HttpCode(201)
  async createPromotionalMessage(@Body() body: PromotionalMessageWriteBody) {
    const data = await this.home.createPromotionalMessage(body);
    return ok(data, 'Promotional message created successfully');
  }

  @Patch('promotional-messages/:id')
  @UseGuards(ApiKeyGuard)
  async patchPromotionalMessage(
    @Param('id') id: string,
    @Body() body: Partial<PromotionalMessageWriteBody>,
  ) {
    const data = await this.home.updatePromotionalMessage(id, body);
    return ok(data, 'Promotional message updated successfully');
  }

  @Delete('promotional-messages/:id')
  @UseGuards(ApiKeyGuard)
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
  @UseGuards(ApiKeyGuard)
  @HttpCode(201)
  async createSocialLink(@Body() body: SocialLinkWriteBody) {
    const data = await this.home.createSocialLink(body);
    return ok(data, 'Social link created successfully');
  }

  @Patch('social-links/:id')
  @UseGuards(ApiKeyGuard)
  async patchSocialLink(
    @Param('id') id: string,
    @Body() body: Partial<SocialLinkWriteBody>,
  ) {
    const data = await this.home.updateSocialLink(id, body);
    return ok(data, 'Social link updated successfully');
  }

  @Delete('social-links/:id')
  @UseGuards(ApiKeyGuard)
  @HttpCode(204)
  async deleteSocialLink(@Param('id') id: string) {
    await this.home.deleteSocialLink(id);
  }
}
