import { PartialType } from '@nestjs/swagger';
import { CreatePaymentSettingDto } from './create-payment-setting.dto';

export class UpdatePaymentSettingDto extends PartialType(
  CreatePaymentSettingDto,
) {}
