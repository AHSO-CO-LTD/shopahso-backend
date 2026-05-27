import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { MailModule } from '../mail/mail.module';
import { BackofficeQuoteRequestsController } from './backoffice-quote-requests.controller';
import { QuoteRequestsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [QuoteRequestsController, BackofficeQuoteRequestsController],
  providers: [QuoteRequestsService, PrismaService, AuthConfigService],
  exports: [QuoteRequestsService],
})
export class QuoteRequestsModule {}
