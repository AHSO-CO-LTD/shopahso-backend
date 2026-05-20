import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/auth.types';
import { ListOrdersQuery } from './list-orders.query';
import { OrdersService } from './orders.service';

@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtUserPayload,
    @Query() query: ListOrdersQuery,
  ) {
    return this.ordersService.findAllForUser(user.sub, query);
  }

  @Get(':orderId')
  findOne(
    @CurrentUser() user: JwtUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.findOneForUser(user.sub, orderId);
  }

  @Post(':orderId/confirm-payment')
  confirmPayment(
    @CurrentUser() user: JwtUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.confirmPaymentByUser(user.sub, orderId);
  }
}
