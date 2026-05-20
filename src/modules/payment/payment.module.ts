import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BackofficePaymentSettingController } from './backoffice-payment-setting.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [AuthModule],
  controllers: [BackofficePaymentSettingController],
  providers: [PaymentService, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}
