import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBrandDto } from './create-brand.dto';
import { UpdateBrandDto } from './update-brand.dto';
import { CloudinaryService } from '../../media/cloudinary.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

@Injectable()
export class BrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findFeatured() {
    const ranked = await this.prisma.productVariant.groupBy({
      by: ['brandId'],
      where: {
        active: true,
        brandId: { not: null },
      },
      _sum: {
        orderCount: true,
      },
      _count: {
        brandId: true,
      },
      orderBy: [
        { _sum: { orderCount: 'desc' } },
        { _count: { brandId: 'desc' } },
      ],
      take: 10,
    });

    const brandIds = ranked
      .map((item) => item.brandId)
      .filter((id): id is string => id !== null);

    if (brandIds.length === 0) {
      return this.findNewestActiveBrands();
    }

    const brands = await this.prisma.brand.findMany({
      where: {
        id: { in: brandIds },
        active: true,
      },
    });

    const brandMap = new Map(brands.map((brand) => [brand.id, brand]));

    const featuredBrands = ranked
      .map((item) => {
        const brandId = item.brandId;
        if (!brandId) {
          return null;
        }

        const brand = brandMap.get(brandId);
        if (!brand) {
          return null;
        }

        return {
          ...brand,
          featuredOrderCount: item._sum?.orderCount ?? 0,
          featuredVariantCount: item._count?.brandId ?? 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (featuredBrands.length > 0) {
      return featuredBrands;
    }

    return this.findNewestActiveBrands();
  }

  findAllBackoffice() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
  }

  findAll() {
    return this.prisma.brand.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.brand.findUnique({
      where: { id },
    });
  }

  create(data: CreateBrandDto) {
    return this.prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
        logoUrl: data.logoUrl,
        bannerUrl: data.bannerUrl,
        active: data.active ?? true,
      },
    });
  }

  async update(id: string, data: UpdateBrandDto) {
    await this.ensureBrandExists(id);

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensureBrandExists(id);

    return this.prisma.brand.update({
      where: { id },
      data: { active: false },
    });
  }

  async uploadLogo(id: string, file: UploadedImageFile) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        logoPublicId: true,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'brands',
      publicId: brand.slug,
      overwrite: true,
    });

    if (brand.logoPublicId && brand.logoPublicId !== uploaded.publicId) {
      await this.cloudinaryService.destroy(brand.logoPublicId);
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        logoUrl: uploaded.secureUrl,
        logoPublicId: uploaded.publicId,
      },
    });
  }

  async uploadBanner(id: string, file: UploadedImageFile) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        bannerPublicId: true,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'brands',
      publicId: `${brand.slug}-banner`,
      overwrite: true,
    });

    if (
      brand.bannerPublicId &&
      brand.bannerPublicId !== uploaded.publicId
    ) {
      await this.cloudinaryService.destroy(brand.bannerPublicId);
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        bannerUrl: uploaded.secureUrl,
        bannerPublicId: uploaded.publicId,
      },
    });
  }

  private async ensureBrandExists(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
  }

  private findNewestActiveBrands() {
    return this.prisma.brand
      .findMany({
        where: { active: true },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
      })
      .then((brands) => {
        if (brands.length > 0) {
          return brands;
        }

        return this.prisma.brand.findMany({
          orderBy: [{ createdAt: 'desc' }],
          take: 10,
        });
      });
  }
}
