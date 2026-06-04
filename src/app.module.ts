import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SlugModule } from './modules/slug/slug.module';
import { CartModule } from './modules/cart/cart.module';
import { TaxModule } from './modules/tax/tax.module';
import { AddressModule } from './modules/address/address.module';
import { PaymentModule } from './modules/payment/payment.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MailModule } from './modules/mail/mail.module';
import { QuoteRequestsModule } from './modules/quote-requests/quote-requests.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { BannersModule } from './modules/banners/banners.module';

@Module({
  imports: [
    CatalogModule,
    AuthModule,
    UsersModule,
    SlugModule,
    CartModule,
    TaxModule,
    AddressModule,
    PaymentModule,
    OrdersModule,
    MailModule,
    QuoteRequestsModule,
    PromotionsModule,
    BannersModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
