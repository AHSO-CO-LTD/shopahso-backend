import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { BackofficeBannersController } from './backoffice-banners.controller';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [BannersController, BackofficeBannersController],
  providers: [BannersService, PrismaService],
  exports: [BannersService],
})
export class BannersModule {}
