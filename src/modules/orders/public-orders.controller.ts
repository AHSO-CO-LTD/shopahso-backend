import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PublicOrderLookupQuery } from './public-order-lookup.query';

@Controller('orders')
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('lookup')
  lookup(@Query() query: PublicOrderLookupQuery) {
    return this.ordersService.findPublicByOrderCodeAndEmail(query);
  }

  @Post('lookup/confirm-payment')
  confirmPayment(@Body() body: PublicOrderLookupQuery) {
    return this.ordersService.confirmPaymentByLookup(body);
  }
}
