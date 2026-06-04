import { Controller, Get, Query } from '@nestjs/common';
import { BannersService } from './banners.service';
import { ListBannersQuery } from './list-banners.query';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findAll(@Query() query: ListBannersQuery) {
    return this.bannersService.findAllPublic(query);
  }
}
