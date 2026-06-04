import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './create-banner.dto';
import { ListBannersQuery } from './list-banners.query';
import { UpdateBannerDto } from './update-banner.dto';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/banners')
export class BackofficeBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findAll(@Query() query: ListBannersQuery) {
    return this.bannersService.findAllBackoffice(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateBannerDto) {
    return this.bannersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBannerDto) {
    return this.bannersService.update(id, body);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    return this.bannersService.uploadImage(id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
