import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VariantController } from './variant.controller';
import { BackofficeVariantController } from './backoffice-variant.controller';
import { BackofficeVariantImportController } from './backoffice-variant-import.controller';
import { VariantService } from './variant.service';
import { CategoryModule } from '../category/category.module';
import { AuthModule } from '../../auth/auth.module';
import { MediaModule } from '../../media/media.module';
import { TaxModule } from '../../tax/tax.module';

@Module({
  imports: [CategoryModule, AuthModule, MediaModule, TaxModule],
  controllers: [
    VariantController,
    BackofficeVariantController,
    BackofficeVariantImportController,
  ],
  providers: [VariantService, PrismaService],
  exports: [VariantService],
})
export class VariantModule {}
