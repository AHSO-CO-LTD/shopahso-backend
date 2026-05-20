import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { CreateCheckoutOrderDto } from './create-checkout-order.dto';
import { OrdersService } from './orders.service';
import { PreviewCheckoutDto } from './preview-checkout.dto';

@ApiBearerAuth()
@ApiHeader({
  name: 'X-Cart-Token',
  required: false,
  description: 'Guest cart token for guest checkout.',
})
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('preview')
  preview(
    @Body() body: PreviewCheckoutDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.ordersService.preview({ authorization, cartToken }, body);
  }

  @Post('orders')
  createOrder(
    @Body() body: CreateCheckoutOrderDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.ordersService.createCheckoutOrder(
      { authorization, cartToken },
      body,
    );
  }
}
