import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../media/cloudinary.service';
import { CreateBannerDto } from './create-banner.dto';
import { ListBannersQuery } from './list-banners.query';
import { UpdateBannerDto } from './update-banner.dto';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  findAllBackoffice(query: ListBannersQuery) {
    return this.prisma.marketingBanner.findMany({
      where: this.buildWhere(query),
      orderBy: [
        { placement: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  findAllPublic(query: ListBannersQuery) {
    return this.prisma.marketingBanner.findMany({
      where: {
        ...this.buildWhere(query),
        active: true,
        imageUrl: { not: null },
      },
      orderBy: [
        { placement: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.marketingBanner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundException('Banner not found');
    }

    return banner;
  }

  create(data: CreateBannerDto) {
    return this.prisma.marketingBanner.create({
      data: {
        placement: data.placement,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl?.trim() || null,
        active: data.active ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, data: UpdateBannerDto) {
    await this.ensureBannerExists(id);

    return this.prisma.marketingBanner.update({
      where: { id },
      data: {
        ...(data.placement !== undefined ? { placement: data.placement } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.linkUrl !== undefined
          ? { linkUrl: data.linkUrl?.trim() || null }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async uploadImage(id: string, file: UploadedImageFile) {
    const banner = await this.findOne(id);

    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'banners',
      publicId: `${banner.placement.toLowerCase()}-${banner.id}-${Date.now()}`,
      overwrite: true,
    });

    if (banner.imagePublicId) {
      await this.cloudinaryService.destroy(banner.imagePublicId);
    }

    return this.prisma.marketingBanner.update({
      where: { id },
      data: {
        imageUrl: uploaded.secureUrl,
        imagePublicId: uploaded.publicId,
      },
    });
  }

  async remove(id: string) {
    const banner = await this.findOne(id);

    if (banner.imagePublicId) {
      await this.cloudinaryService.destroy(banner.imagePublicId);
    }

    await this.prisma.marketingBanner.delete({ where: { id } });

    return { deleted: true };
  }

  private buildWhere(
    query: ListBannersQuery,
  ): Prisma.MarketingBannerWhereInput {
    return {
      ...(query.placement ? { placement: query.placement } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
    };
  }

  private async ensureBannerExists(id: string) {
    const banner = await this.prisma.marketingBanner.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
  }
}
