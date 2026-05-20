import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AddCartItemDto } from './add-cart-item.dto';
import { CartService } from './cart.service';
import { UpdateCartItemDto } from './update-cart-item.dto';

@ApiBearerAuth()
@ApiHeader({
  name: 'X-Cart-Token',
  required: false,
  description: 'Guest cart token. Backend returns this token for guest carts.',
})
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  findCurrent(
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.findCurrent({ authorization, cartToken });
  }

  @Post('items')
  addItem(
    @Body() data: AddCartItemDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.addItem(data, { authorization, cartToken });
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() data: UpdateCartItemDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.updateItem(itemId, data, {
      authorization,
      cartToken,
    });
  }

  @Delete('items/:itemId')
  removeItem(
    @Param('itemId') itemId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.removeItem(itemId, { authorization, cartToken });
  }

  @Delete()
  clear(
    @Headers('authorization') authorization?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.clear({ authorization, cartToken });
  }
}
