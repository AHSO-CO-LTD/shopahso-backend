import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BackofficeTaxController } from './backoffice-tax.controller';
import { TaxService } from './tax.service';

@Module({
  imports: [AuthModule],
  controllers: [BackofficeTaxController],
  providers: [TaxService, PrismaService],
  exports: [TaxService],
})
export class TaxModule {}
