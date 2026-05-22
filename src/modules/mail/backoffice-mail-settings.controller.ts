import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MailService } from './mail.service';
import { TestMailDto } from './test-mail.dto';
import { UpdateMailSettingDto } from './update-mail-setting.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/mail-settings')
export class BackofficeMailSettingsController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  findOne() {
    return this.mailService.getSetting();
  }

  @Patch()
  update(@Body() body: UpdateMailSettingDto) {
    return this.mailService.updateSetting(body);
  }

  @Post('test')
  test(@Body() body: TestMailDto) {
    return this.mailService.sendTestMail(body.email);
  }
}
