import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppRole } from '@prisma/client';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
import { AccessTokenGuard } from '../../auth/access-token.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { RemoveImageDto } from '../../media/remove-image.dto';
import { ListDescriptionAssetsQuery } from './list-description-assets.query';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/products')
export class BackofficeProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() body: CreateProductDto) {
    return this.productService.create(body);
  }

  @Get()
  findAll() {
    return this.productService.findAllBackoffice();
  }

  @Get('description-images')
  findDescriptionAssets(@Query() query: ListDescriptionAssetsQuery) {
    return this.productService.findDescriptionAssets(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productService.findOne(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productService.update(id, body);
  }

  @Post(':id/images')
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

    return this.productService.uploadImage(id, file);
  }

  @Post(':id/description-images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadDescriptionImage(
    @Param('id') id: string,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    return this.productService.uploadDescriptionImage(id, file);
  }

  @Delete(':id/images')
  removeImage(@Param('id') id: string, @Body() body: RemoveImageDto) {
    return this.productService.removeImage(id, body.publicId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
