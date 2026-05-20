import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';

@Module({
  imports: [AuthModule],
  controllers: [AddressController],
  providers: [AddressService, PrismaService],
  exports: [AddressService],
})
export class AddressModule {}
