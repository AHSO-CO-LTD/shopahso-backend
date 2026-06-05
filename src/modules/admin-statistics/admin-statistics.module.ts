import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AdminStatisticsController } from './admin-statistics.controller';
import { AdminStatisticsService } from './admin-statistics.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminStatisticsController],
  providers: [AdminStatisticsService, PrismaService],
})
export class AdminStatisticsModule {}
