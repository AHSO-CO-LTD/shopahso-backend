import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminStatisticsQuery } from './admin-statistics.query';
import { AdminStatisticsService } from './admin-statistics.service';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.ADMIN)
@ApiBearerAuth()
@Controller('admin/statistics')
export class AdminStatisticsController {
  constructor(
    private readonly adminStatisticsService: AdminStatisticsService,
  ) {}

  @Get('dashboard')
  getDashboard(@Query() query: AdminStatisticsQuery) {
    return this.adminStatisticsService.getDashboard(query);
  }

  @Get('website')
  getWebsite(@Query() query: AdminStatisticsQuery) {
    return this.adminStatisticsService.getWebsite(query);
  }

  @Get('users')
  getUsers(@Query() query: AdminStatisticsQuery) {
    return this.adminStatisticsService.getUsers(query);
  }

  @Get('products')
  getProducts(@Query() query: AdminStatisticsQuery) {
    return this.adminStatisticsService.getProducts(query);
  }

  @Get('orders')
  getOrders(@Query() query: AdminStatisticsQuery) {
    return this.adminStatisticsService.getOrders(query);
  }

  @Get('quote-requests')
  getQuoteRequests(@Query() query: AdminStatisticsQuery) {
    return this.adminStatisticsService.getQuoteRequests(query);
  }
}
