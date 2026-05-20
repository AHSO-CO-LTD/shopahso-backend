import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListOrdersQuery } from './list-orders.query';
import { OrdersService } from './orders.service';
import { ReviewPaymentDto } from './review-payment.dto';
import { UpdateFulfillmentDto } from './update-fulfillment.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/orders')
export class BackofficeOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: ListOrdersQuery) {
    return this.ordersService.findAllForBackoffice(query);
  }

  @Get(':orderId')
  findOne(@Param('orderId') orderId: string) {
    return this.ordersService.findOneForBackoffice(orderId);
  }

  @Patch(':orderId/payment-review')
  reviewPayment(
    @CurrentUser() user: JwtUserPayload,
    @Param('orderId') orderId: string,
    @Body() body: ReviewPaymentDto,
  ) {
    return this.ordersService.reviewPayment(orderId, user.sub, body);
  }

  @Patch(':orderId/fulfillment')
  updateFulfillment(
    @Param('orderId') orderId: string,
    @Body() body: UpdateFulfillmentDto,
  ) {
    return this.ordersService.updateFulfillment(orderId, body);
  }
}
