import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductController } from './product.controller';
import { BackofficeProductController } from './backoffice-product.controller';
import { ProductService } from './product.service';
import { AuthModule } from '../../auth/auth.module';
import { MediaModule } from '../../media/media.module';
import { TaxModule } from '../../tax/tax.module';
import { PricingModule } from '../../pricing/pricing.module';

@Module({
  imports: [AuthModule, MediaModule, TaxModule, PricingModule],
  controllers: [ProductController, BackofficeProductController],
  providers: [ProductService, PrismaService],
  exports: [ProductService],
})
export class ProductModule {}
