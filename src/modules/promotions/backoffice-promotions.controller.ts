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
import { CreatePromotionDto } from './create-promotion.dto';
import { ListPromotionsQuery } from './list-promotions.query';
import {
  AddPromotionItemDto,
  UpdatePromotionItemDto,
} from './promotion-item.dto';
import { PromotionsService } from './promotions.service';
import { UpdatePromotionDto } from './update-promotion.dto';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/promotions')
export class BackofficePromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  findAll(@Query() query: ListPromotionsQuery) {
    return this.promotionsService.findAllBackoffice(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOneBackoffice(id);
  }

  @Post()
  create(@Body() body: CreatePromotionDto) {
    return this.promotionsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePromotionDto) {
    return this.promotionsService.update(id, body);
  }

  @Patch(':id/end')
  endPromotion(@Param('id') id: string) {
    return this.promotionsService.endPromotion(id);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() body: AddPromotionItemDto) {
    return this.promotionsService.addItem(id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdatePromotionItemDto,
  ) {
    return this.promotionsService.updateItem(id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.promotionsService.removeItem(id, itemId);
  }

  @Post(':id/banner-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadBannerImage(
    @Param('id') id: string,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    return this.promotionsService.uploadBannerImage(id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(id);
  }
}
