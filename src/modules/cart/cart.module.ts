import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { TaxModule } from '../tax/tax.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [AuthModule, TaxModule],
  controllers: [CartController],
  providers: [CartService, PrismaService],
  exports: [CartService],
})
export class CartModule {}
