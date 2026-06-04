import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
import { CloudinaryService } from '../../media/cloudinary.service';
import { TaxService } from '../../tax/tax.service';
import { sanitizeProductDescriptionHtml } from '../../../common/utils/sanitize-html.util';
import { ListDescriptionAssetsQuery } from './list-description-assets.query';
import { PricingService } from '../../pricing/pricing.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly taxService: TaxService,
    private readonly pricingService: PricingService,
  ) {}

  async findFeatured() {
    const products = await this.prisma.product.findMany({
      where: { active: true, status: 'PUBLISHED' },
      orderBy: [{ variants: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: 10,
      include: {
        category: true,
        brand: true,
        variants: {
          where: { active: true },
          orderBy: [
            { score: 'desc' },
            { orderCount: 'desc' },
            { viewCount: 'desc' },
            { name: 'asc' },
          ],
          take: 1,
        },
      },
    });

    const normalized = await Promise.all(
      products.map((product) => this.withPublicProductPricing(product, true)),
    );

    if (normalized.length > 0) {
      return normalized;
    }

    return this.findNewest();
  }

  async findNewest() {
    const products = await this.prisma.product.findMany({
      where: { active: true, status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
      include: {
        category: true,
        brand: true,
        variants: {
          where: { active: true },
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    const normalized = await Promise.all(
      products.map((product) => this.withPublicProductPricing(product)),
    );

    if (normalized.length > 0) {
      return normalized;
    }

    const fallbackProducts = await this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
      include: {
        category: true,
        brand: true,
        variants: {
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    return Promise.all(
      fallbackProducts.map((product) => this.withPublicProductPricing(product)),
    );
  }

  findAllBackoffice() {
    return this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        category: true,
        brand: true,
        _count: {
          select: {
            variants: true,
            attributes: true,
          },
        },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        variants: {
          orderBy: [{ score: 'desc' }, { name: 'asc' }],
        },
        attributes: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  async create(data: CreateProductDto) {
    await this.ensureCategoryExists(data.categoryId);

    if (data.brandId) {
      await this.ensureBrandExists(data.brandId);
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          categoryId: data.categoryId,
          brandId: data.brandId,
          name: data.name,
          slug: data.slug,
          description: sanitizeProductDescriptionHtml(data.description),
          datasheetUrl: data.datasheetUrl,
          imageUrls: data.imageUrls ?? [],
          imagePublicIds: [],
          status: data.status ?? 'DRAFT',
          active: data.active ?? true,
        },
        include: {
          category: true,
          brand: true,
        },
      });

      const templates = await tx.categoryAttributeTemplate.findMany({
        where: {
          categoryId: data.categoryId,
          active: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      if (templates.length > 0) {
        await tx.productAttributeDefinition.createMany({
          data: templates.map((template) => ({
            productId: product.id,
            categoryTemplateId: template.id,
            name: template.name,
            code: template.code,
            dataType: template.dataType,
            unit: template.unit,
            isFilterable: template.isFilterable,
            isSearchable: template.isSearchable,
            isRequired: template.isRequired,
            sortOrder: template.sortOrder,
            active: template.active,
          })),
        });
      }

      return product;
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        active: true,
        status: 'PUBLISHED',
      },
      include: {
        category: true,
        brand: true,
        variants: {
          where: { active: true },
          orderBy: [{ score: 'desc' }, { name: 'asc' }],
        },
        attributes: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!product) {
      return null;
    }

    return {
      ...product,
      variants: await Promise.all(
        product.variants.map((variant) =>
          this.withPublicVariantPricing(variant, product.imageUrls),
        ),
      ),
    };
  }

  async update(id: string, data: UpdateProductDto) {
    const current = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        brandId: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Product not found');
    }

    if (data.categoryId) {
      await this.ensureCategoryExists(data.categoryId);
    }

    if (data.brandId) {
      await this.ensureBrandExists(data.brandId);
    }

    const nextCategoryId = data.categoryId ?? current.categoryId;
    const nextBrandId =
      data.brandId !== undefined ? data.brandId : current.brandId;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          ...(data.categoryId !== undefined
            ? { categoryId: data.categoryId }
            : {}),
          ...(data.brandId !== undefined ? { brandId: data.brandId } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.slug !== undefined ? { slug: data.slug } : {}),
          ...(data.description !== undefined
            ? {
                description: sanitizeProductDescriptionHtml(data.description),
              }
            : {}),
          ...(data.datasheetUrl !== undefined
            ? { datasheetUrl: data.datasheetUrl }
            : {}),
          ...(data.imageUrls !== undefined
            ? { imageUrls: data.imageUrls }
            : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
        include: {
          category: true,
          brand: true,
        },
      });

      if (
        nextCategoryId !== current.categoryId ||
        nextBrandId !== current.brandId
      ) {
        await tx.productVariant.updateMany({
          where: { productId: id },
          data: {
            categoryId: nextCategoryId,
            brandId: nextBrandId,
          },
        });
      }

      return product;
    });
  }

  async remove(id: string) {
    await this.ensureProductExists(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { active: false },
      });

      return tx.product.update({
        where: { id },
        data: { active: false },
      });
    });
  }

  async uploadImage(id: string, file: UploadedImageFile) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        imageUrls: true,
        imagePublicIds: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'products',
      publicId: `${product.slug}-${Date.now()}`,
    });

    return this.prisma.product.update({
      where: { id },
      data: {
        imageUrls: [...product.imageUrls, uploaded.secureUrl],
        imagePublicIds: [...product.imagePublicIds, uploaded.publicId],
      },
    });
  }

  async uploadDescriptionImage(id: string, file: UploadedImageFile) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const timestamp = Date.now();
    const alt = this.createDescriptionImageAlt(file.originalname, product.name);
    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'products/descriptions',
      publicId: `${product.slug}-description-${timestamp}`,
    });

    const asset = await this.prisma.productDescriptionAsset.create({
      data: {
        productId: product.id,
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        alt,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      id: asset.id,
      url: asset.url,
      publicId: asset.publicId,
      alt: asset.alt,
      product: asset.product,
      createdAt: asset.createdAt,
    };
  }

  async findDescriptionAssets(query: ListDescriptionAssetsQuery) {
    const where: Prisma.ProductDescriptionAssetWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { alt: { contains: search, mode: 'insensitive' } },
        { publicId: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { slug: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.productDescriptionAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 60,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async removeImage(id: string, publicId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrls: true,
        imagePublicIds: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const index = product.imagePublicIds.findIndex(
      (value) => value === publicId,
    );
    if (index === -1) {
      throw new NotFoundException('Image not found');
    }

    await this.cloudinaryService.destroy(publicId);

    const nextUrls = product.imageUrls.filter((_, idx) => idx !== index);
    const nextPublicIds = product.imagePublicIds.filter(
      (_, idx) => idx !== index,
    );

    return this.prisma.product.update({
      where: { id },
      data: {
        imageUrls: nextUrls,
        imagePublicIds: nextPublicIds,
      },
    });
  }

  private async withPublicProductPricing<
    TProduct extends Prisma.ProductGetPayload<{
      include: { variants: true };
    }>,
  >(product: TProduct, includeFeaturedScore = false) {
    const variants = await Promise.all(
      product.variants.map((variant) =>
        this.withPublicVariantPricing(variant, product.imageUrls),
      ),
    );

    return {
      ...product,
      ...(includeFeaturedScore
        ? { featuredScore: product.variants[0]?.score ?? 0 }
        : {}),
      variants,
      effectiveImageUrls:
        product.imageUrls.length > 0
          ? product.imageUrls
          : (product.variants[0]?.imageUrls ?? []),
    };
  }

  private async withPublicVariantPricing<
    TVariant extends Prisma.ProductVariantGetPayload<object>,
  >(variant: TVariant, productImageUrls: string[]) {
    const pricing = await this.pricingService.resolveVariantPricing(variant);
    const effectivePrice = pricing.effectivePrice;
    const tax = await this.taxService.resolveEffectiveTax({
      categoryId: variant.categoryId,
      productId: variant.productId,
      variantId: variant.id,
    });
    const taxAmount = effectivePrice
      .times(tax.taxPercent)
      .div(100)
      .toDecimalPlaces(2);

    return {
      ...variant,
      rating: this.serializeVariantRating(variant),
      effectiveImageUrls:
        variant.imageUrls.length > 0 ? variant.imageUrls : productImageUrls,
      tax: {
        source: tax.scope,
        targetId: tax.targetId,
        percent: tax.taxPercent.toString(),
      },
      pricing: {
        ...this.pricingService.serializePricing(pricing),
        effectivePrice: effectivePrice.toString(),
        taxAmount: taxAmount.toString(),
        totalWithTax: effectivePrice.plus(taxAmount).toString(),
      },
    };
  }

  private serializeVariantRating(
    variant: Pick<
      Prisma.ProductVariantGetPayload<object>,
      'ratingAverage' | 'ratingCount' | 'ratingTotal'
    >,
  ) {
    return {
      average: variant.ratingAverage.toString(),
      count: variant.ratingCount,
      total: variant.ratingTotal.toString(),
      baselineAverage: '5.00',
      baselineCounted: false,
    };
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
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

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private createDescriptionImageAlt(
    originalName: string | undefined,
    productName: string,
  ) {
    const fileName = originalName?.replace(/\.[^/.]+$/, '').trim();
    const source = fileName || productName;

    return source
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }
}
