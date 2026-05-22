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
import { CancelOrderDto } from './cancel-order.dto';
import { ListOrdersQuery } from './list-orders.query';
import { OrderStaffNoteDto } from './order-staff-note.dto';
import { OrdersService } from './orders.service';
import { RejectOrderDto } from './reject-order.dto';
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

  @Patch(':orderId/confirm')
  confirmOrder(
    @Param('orderId') orderId: string,
    @Body() body: OrderStaffNoteDto,
  ) {
    return this.ordersService.confirmOrder(orderId, body);
  }

  @Patch(':orderId/reject')
  rejectOrder(@Param('orderId') orderId: string, @Body() body: RejectOrderDto) {
    return this.ordersService.rejectOrder(orderId, body);
  }

  @Patch(':orderId/cancel')
  cancelOrder(@Param('orderId') orderId: string, @Body() body: CancelOrderDto) {
    return this.ordersService.cancelOrder(orderId, body);
  }

  @Patch(':orderId/confirm-payment')
  confirmPayment(
    @CurrentUser() user: JwtUserPayload,
    @Param('orderId') orderId: string,
    @Body() body: OrderStaffNoteDto,
  ) {
    return this.ordersService.confirmPaymentByStaff(orderId, user.sub, body);
  }

  @Patch(':orderId/reject-payment')
  rejectPayment(
    @Param('orderId') orderId: string,
    @Body() body: RejectOrderDto,
  ) {
    return this.ordersService.rejectPaymentByStaff(orderId, body);
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

  @Patch(':orderId/staff-note')
  updateStaffNote(
    @Param('orderId') orderId: string,
    @Body() body: OrderStaffNoteDto,
  ) {
    return this.ordersService.updateStaffNote(orderId, body);
  }
}
