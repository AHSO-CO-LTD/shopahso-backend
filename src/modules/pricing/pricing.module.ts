import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from './pricing.service';

@Module({
  providers: [PricingService, PrismaService],
  exports: [PricingService],
})
export class PricingModule {}
