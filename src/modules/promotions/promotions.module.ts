import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PricingModule } from '../pricing/pricing.module';
import { TaxModule } from '../tax/tax.module';
import { BackofficePromotionsController } from './backoffice-promotions.controller';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [AuthModule, MediaModule, PricingModule, TaxModule],
  controllers: [PromotionsController, BackofficePromotionsController],
  providers: [PromotionsService, PrismaService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
