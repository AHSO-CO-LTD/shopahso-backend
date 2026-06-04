import { Controller, Get, Param } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  findAll() {
    return this.promotionsService.findAllPublic();
  }

  @Get('discounted-variants')
  findDiscountedVariants() {
    return this.promotionsService.findDiscountedVariants();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.promotionsService.findPublicBySlug(slug);
  }
}
