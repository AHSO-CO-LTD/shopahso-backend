import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePaymentSettingDto } from './create-payment-setting.dto';
import { PaymentService } from './payment.service';
import { TestVietQrDto } from './test-vietqr.dto';
import { UpdatePaymentSettingDto } from './update-payment-setting.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/payment-settings')
export class BackofficePaymentSettingController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  findAll() {
    return this.paymentService.findAllSettings();
  }

  @Post()
  create(@Body() body: CreatePaymentSettingDto) {
    return this.paymentService.createSetting(body);
  }

  @Post('test-vietqr')
  testVietQr(@Body() body: TestVietQrDto) {
    return this.paymentService.buildTestVietQrPayment(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePaymentSettingDto) {
    return this.paymentService.updateSetting(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentService.removeSetting(id);
  }
}
