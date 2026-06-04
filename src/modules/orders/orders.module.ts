import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';
import { TaxModule } from '../tax/tax.module';
import { MailModule } from '../mail/mail.module';
import { PricingModule } from '../pricing/pricing.module';
import { BackofficeOrdersController } from './backoffice-orders.controller';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PublicOrdersController } from './public-orders.controller';

@Module({
  imports: [AuthModule, TaxModule, PaymentModule, MailModule, PricingModule],
  controllers: [
    CheckoutController,
    PublicOrdersController,
    OrdersController,
    BackofficeOrdersController,
  ],
  providers: [OrdersService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
