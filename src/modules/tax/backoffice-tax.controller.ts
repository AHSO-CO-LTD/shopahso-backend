import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DeleteTaxSettingDto } from './delete-tax-setting.dto';
import { TaxService } from './tax.service';
import { UpsertTaxSettingDto } from './upsert-tax-setting.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/tax-settings')
export class BackofficeTaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  findAll() {
    return this.taxService.findAll();
  }

  @Post()
  upsert(@Body() body: UpsertTaxSettingDto) {
    return this.taxService.upsert(body);
  }

  @Delete()
  remove(@Body() body: DeleteTaxSettingDto) {
    return this.taxService.remove(body);
  }
}
