import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthConfigService } from './auth-config.service';
import { AccessTokenGuard } from './access-token.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => MailModule)],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    AuthConfigService,
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [
    JwtModule,
    AuthService,
    AuthConfigService,
    AccessTokenGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
