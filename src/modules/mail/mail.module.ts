import { forwardRef, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BackofficeMailSettingsController } from './backoffice-mail-settings.controller';
import { MailConfigService } from './mail-config.service';
import { MailTemplatesService } from './mail-templates.service';
import { MailService } from './mail.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [BackofficeMailSettingsController],
  providers: [
    PrismaService,
    MailConfigService,
    MailTemplatesService,
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
