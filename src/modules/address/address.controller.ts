import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/auth.types';
import { AddressService } from './address.service';
import { CreateUserAddressDto } from './create-user-address.dto';
import { UpdateUserAddressDto } from './update-user-address.dto';

@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('user-addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUserPayload) {
    return this.addressService.findAll(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUserPayload,
    @Body() data: CreateUserAddressDto,
  ) {
    return this.addressService.create(user.sub, data);
  }

  @Patch(':addressId')
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('addressId') addressId: string,
    @Body() data: UpdateUserAddressDto,
  ) {
    return this.addressService.update(user.sub, addressId, data);
  }

  @Patch(':addressId/default')
  setDefault(
    @CurrentUser() user: JwtUserPayload,
    @Param('addressId') addressId: string,
  ) {
    return this.addressService.setDefault(user.sub, addressId);
  }

  @Delete(':addressId')
  remove(
    @CurrentUser() user: JwtUserPayload,
    @Param('addressId') addressId: string,
  ) {
    return this.addressService.remove(user.sub, addressId);
  }
}
