import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PromotionDiscountType, PromotionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../media/cloudinary.service';
import { PricingService } from '../pricing/pricing.service';
import { TaxService } from '../tax/tax.service';
import { CreatePromotionDto } from './create-promotion.dto';
import { ListPromotionsQuery } from './list-promotions.query';
import {
  AddPromotionItemDto,
  PromotionItemDto,
  UpdatePromotionItemDto,
} from './promotion-item.dto';
import { UpdatePromotionDto } from './update-promotion.dto';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

type PromotionWithItems = Prisma.PromotionGetPayload<{
  include: ReturnType<PromotionsService['promotionInclude']>;
}>;

type PublicVariant = Prisma.ProductVariantGetPayload<{
  include: {
    product: true;
    category: true;
    brand: true;
  };
}>;

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly pricingService: PricingService,
    private readonly taxService: TaxService,
  ) {}

  async findAllBackoffice(query: ListPromotionsQuery) {
    const promotions = await this.prisma.promotion.findMany({
      where: this.buildBackofficeWhere(query),
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return promotions.map((promotion) =>
      this.serializePromotionSummary(promotion),
    );
  }

  async findOneBackoffice(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: this.promotionInclude(),
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return this.serializePromotion(promotion);
  }

  async findAllPublic() {
    const promotions = await this.prisma.promotion.findMany({
      where: this.activePromotionWhere(),
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return promotions.map((promotion) =>
      this.serializePromotionSummary(promotion),
    );
  }

  async findPublicBySlug(slug: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        slug,
        ...this.activePromotionWhere(),
      },
      include: this.promotionInclude(),
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    const serialized = this.serializePromotion(promotion);
    const variants = await this.serializePublicVariants(
      promotion.items.map((item) => item.variant),
    );
    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    return {
      ...serialized,
      items: serialized.items.map((item) => ({
        ...item,
        variant: variantMap.get(item.variant.id) ?? item.variant,
      })),
    };
  }

  async findDiscountedVariants() {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        active: true,
        product: {
          active: true,
          status: 'PUBLISHED',
        },
        OR: [
          { salePrice: { not: null } },
          { discountPercent: { not: null } },
          {
            promotionItems: {
              some: {
                promotion: this.activePromotionWhere(),
              },
            },
          },
        ],
      },
      include: {
        product: true,
        category: true,
        brand: true,
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    const serialized = await this.serializePublicVariants(variants);
    return serialized.filter((variant) => variant.pricing.discount !== null);
  }

  async create(data: CreatePromotionDto) {
    const discountType =
      data.defaultDiscountType ?? PromotionDiscountType.PERCENT;
    this.validateSchedule(data.startsAt, data.endsAt ?? null);
    this.validateDiscountValue(discountType, data.defaultDiscountValue);

    const items = this.normalizeItems(data.items ?? []);
    await this.ensureVariantsExist(items.map((item) => item.variantId));
    await this.assertNoActivePromotionConflict({
      variantIds: items.map((item) => item.variantId),
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      status: data.status ?? PromotionStatus.DRAFT,
    });

    const promotion = await this.prisma.promotion.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description?.trim() || null,
        bannerImageUrl: data.bannerImageUrl,
        bannerLinkUrl: data.bannerLinkUrl?.trim() || null,
        defaultDiscountType: discountType,
        defaultDiscountValue: new Prisma.Decimal(data.defaultDiscountValue),
        status: data.status ?? PromotionStatus.DRAFT,
        startsAt: data.startsAt,
        endsAt: data.endsAt ?? null,
        items: {
          create: items.map((item) => ({
            variantId: item.variantId,
            discountType: item.discountType ?? null,
            discountValue:
              item.discountValue !== undefined
                ? new Prisma.Decimal(item.discountValue)
                : null,
          })),
        },
      },
      include: this.promotionInclude(),
    });

    return this.serializePromotion(promotion);
  }

  async update(id: string, data: UpdatePromotionDto) {
    const current = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        items: {
          select: { variantId: true },
        },
      },
    });

    if (!current) {
      throw new NotFoundException('Promotion not found');
    }

    const discountType =
      data.defaultDiscountType ?? current.defaultDiscountType;
    const discountValue =
      data.defaultDiscountValue !== undefined
        ? data.defaultDiscountValue
        : Number(current.defaultDiscountValue);
    const startsAt = data.startsAt ?? current.startsAt;
    const endsAt = data.endsAt !== undefined ? data.endsAt : current.endsAt;
    const status = data.status ?? current.status;
    const nextItems =
      data.items !== undefined
        ? this.normalizeItems(data.items)
        : current.items.map((item) => ({ variantId: item.variantId }));

    this.validateSchedule(startsAt, endsAt);
    this.validateDiscountValue(discountType, discountValue);
    await this.ensureVariantsExist(nextItems.map((item) => item.variantId));
    await this.assertNoActivePromotionConflict({
      variantIds: nextItems.map((item) => item.variantId),
      startsAt,
      endsAt,
      status,
      excludePromotionId: id,
    });

    const promotion = await this.prisma.$transaction(async (tx) => {
      if (data.items !== undefined) {
        await tx.promotionItem.deleteMany({
          where: { promotionId: id },
        });
      }

      return tx.promotion.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.slug !== undefined ? { slug: data.slug.trim() } : {}),
          ...(data.description !== undefined
            ? { description: data.description?.trim() || null }
            : {}),
          ...(data.bannerImageUrl !== undefined
            ? { bannerImageUrl: data.bannerImageUrl }
            : {}),
          ...(data.bannerLinkUrl !== undefined
            ? { bannerLinkUrl: data.bannerLinkUrl?.trim() || null }
            : {}),
          ...(data.defaultDiscountType !== undefined
            ? { defaultDiscountType: data.defaultDiscountType }
            : {}),
          ...(data.defaultDiscountValue !== undefined
            ? {
                defaultDiscountValue: new Prisma.Decimal(
                  data.defaultDiscountValue,
                ),
              }
            : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
          ...(data.endsAt !== undefined ? { endsAt: data.endsAt ?? null } : {}),
          ...(data.items !== undefined
            ? {
                items: {
                  create: this.normalizeItems(data.items).map((item) => ({
                    variantId: item.variantId,
                    discountType: item.discountType ?? null,
                    discountValue:
                      item.discountValue !== undefined
                        ? new Prisma.Decimal(item.discountValue)
                        : null,
                  })),
                },
              }
            : {}),
        },
        include: this.promotionInclude(),
      });
    });

    return this.serializePromotion(promotion);
  }

  async endPromotion(id: string) {
    await this.ensurePromotionExists(id);

    const now = new Date();
    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: {
        status: PromotionStatus.ENDED,
        endsAt: now,
      },
      include: this.promotionInclude(),
    });

    return this.serializePromotion(promotion);
  }

  async addItem(promotionId: string, data: AddPromotionItemDto) {
    const promotion = await this.ensurePromotionExists(promotionId);
    const [item] = this.normalizeItems([data]);
    await this.ensureVariantsExist([item.variantId]);
    await this.assertNoActivePromotionConflict({
      variantIds: [item.variantId],
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      status: promotion.status,
      excludePromotionId: promotionId,
    });

    await this.prisma.promotionItem.create({
      data: {
        promotionId,
        variantId: item.variantId,
        discountType: item.discountType ?? null,
        discountValue:
          item.discountValue !== undefined
            ? new Prisma.Decimal(item.discountValue)
            : null,
      },
    });

    return this.findOneBackoffice(promotionId);
  }

  async updateItem(
    promotionId: string,
    itemId: string,
    data: UpdatePromotionItemDto,
  ) {
    const promotion = await this.ensurePromotionExists(promotionId);
    const currentItem = await this.prisma.promotionItem.findFirst({
      where: { id: itemId, promotionId },
    });

    if (!currentItem) {
      throw new NotFoundException('Promotion item not found');
    }

    const variantId = data.variantId ?? currentItem.variantId;
    const hasDiscountType = 'discountType' in data;
    const hasDiscountValue = 'discountValue' in data;
    const discountType = hasDiscountType
      ? data.discountType
      : currentItem.discountType;
    const discountValue = hasDiscountValue
      ? data.discountValue
      : currentItem.discountValue !== null
        ? Number(currentItem.discountValue)
        : undefined;

    this.validateItemDiscount({ discountType, discountValue });
    if (discountType && discountValue !== undefined) {
      this.validateDiscountValue(discountType, discountValue);
    }

    await this.ensureVariantsExist([variantId]);
    await this.assertNoActivePromotionConflict({
      variantIds: [variantId],
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      status: promotion.status,
      excludePromotionId: promotionId,
    });

    await this.prisma.promotionItem.update({
      where: { id: itemId },
      data: {
        ...(data.variantId !== undefined ? { variantId } : {}),
        ...(hasDiscountType ? { discountType: data.discountType ?? null } : {}),
        ...(hasDiscountValue
          ? {
              discountValue:
                data.discountValue !== undefined
                  ? new Prisma.Decimal(data.discountValue)
                  : null,
            }
          : {}),
      },
    });

    return this.findOneBackoffice(promotionId);
  }

  async removeItem(promotionId: string, itemId: string) {
    const item = await this.prisma.promotionItem.findFirst({
      where: { id: itemId, promotionId },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Promotion item not found');
    }

    await this.prisma.promotionItem.delete({
      where: { id: item.id },
    });

    return this.findOneBackoffice(promotionId);
  }

  async uploadBannerImage(id: string, file: UploadedImageFile) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        bannerImagePublicId: true,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'promotions',
      publicId: `${promotion.slug}-banner-${Date.now()}`,
      overwrite: true,
    });

    if (promotion.bannerImagePublicId) {
      await this.cloudinaryService.destroy(promotion.bannerImagePublicId);
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        bannerImageUrl: uploaded.secureUrl,
        bannerImagePublicId: uploaded.publicId,
      },
      include: this.promotionInclude(),
    });

    return this.serializePromotion(updated);
  }

  async remove(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      select: {
        id: true,
        bannerImagePublicId: true,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    if (promotion.bannerImagePublicId) {
      await this.cloudinaryService.destroy(promotion.bannerImagePublicId);
    }

    await this.prisma.promotion.delete({ where: { id } });

    return { deleted: true };
  }

  private buildBackofficeWhere(
    query: ListPromotionsQuery,
  ): Prisma.PromotionWhereInput {
    const search = query.q?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private activePromotionWhere(): Prisma.PromotionWhereInput {
    const now = new Date();

    return {
      status: PromotionStatus.ACTIVE,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    };
  }

  private validateSchedule(startsAt: Date, endsAt: Date | null) {
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        'Promotion end date must be after start date',
      );
    }
  }

  private validateDiscountValue(type: PromotionDiscountType, value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(
        'Discount value must be greater than or equal to 0',
      );
    }

    if (type === PromotionDiscountType.PERCENT && value > 100) {
      throw new BadRequestException(
        'Percent discount cannot be greater than 100',
      );
    }
  }

  private normalizeItems(items: PromotionItemDto[]) {
    const seenVariantIds = new Set<string>();

    return items.map((item) => {
      if (seenVariantIds.has(item.variantId)) {
        throw new BadRequestException('Promotion variant ids must be unique');
      }
      seenVariantIds.add(item.variantId);

      this.validateItemDiscount(item);
      if (item.discountType && item.discountValue !== undefined) {
        this.validateDiscountValue(item.discountType, item.discountValue);
      }

      return {
        variantId: item.variantId,
        discountType: item.discountType,
        discountValue: item.discountValue,
      };
    });
  }

  private validateItemDiscount(data: {
    discountType?: PromotionDiscountType | null;
    discountValue?: number | null;
  }) {
    const hasType =
      data.discountType !== undefined && data.discountType !== null;
    const hasValue =
      data.discountValue !== undefined && data.discountValue !== null;

    if (hasType !== hasValue) {
      throw new BadRequestException(
        'Promotion item override must include both discountType and discountValue',
      );
    }
  }

  private async ensureVariantsExist(variantIds: string[]) {
    const uniqueVariantIds = [...new Set(variantIds)];
    if (uniqueVariantIds.length === 0) {
      return;
    }

    const count = await this.prisma.productVariant.count({
      where: { id: { in: uniqueVariantIds } },
    });

    if (count !== uniqueVariantIds.length) {
      throw new NotFoundException('Some promotion variants were not found');
    }
  }

  private async ensurePromotionExists(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  private async assertNoActivePromotionConflict(input: {
    variantIds: string[];
    startsAt: Date;
    endsAt: Date | null;
    status: PromotionStatus;
    excludePromotionId?: string;
  }) {
    const variantIds = [...new Set(input.variantIds)];
    if (input.status !== PromotionStatus.ACTIVE || variantIds.length === 0) {
      return;
    }

    const conflict = await this.prisma.promotionItem.findFirst({
      where: {
        variantId: { in: variantIds },
        promotion: {
          status: PromotionStatus.ACTIVE,
          ...(input.excludePromotionId
            ? { id: { not: input.excludePromotionId } }
            : {}),
          ...(input.endsAt ? { startsAt: { lte: input.endsAt } } : {}),
          OR: [{ endsAt: null }, { endsAt: { gte: input.startsAt } }],
        },
      },
      include: {
        promotion: {
          select: {
            name: true,
            slug: true,
          },
        },
        variant: {
          select: {
            sku: true,
            name: true,
          },
        },
      },
    });

    if (conflict) {
      throw new BadRequestException(
        `Variant ${conflict.variant.sku} is already in active promotion ${conflict.promotion.name}`,
      );
    }
  }

  private promotionInclude() {
    return {
      items: {
        orderBy: [{ createdAt: 'desc' }],
        include: {
          variant: {
            include: {
              product: true,
              category: true,
              brand: true,
            },
          },
        },
      },
    } satisfies Prisma.PromotionInclude;
  }

  private serializePromotionSummary(
    promotion: Prisma.PromotionGetPayload<{
      include: { _count: { select: { items: true } } };
    }>,
  ) {
    return {
      ...promotion,
      defaultDiscountValue: promotion.defaultDiscountValue.toString(),
    };
  }

  private serializePromotion(promotion: PromotionWithItems) {
    return {
      ...promotion,
      defaultDiscountValue: promotion.defaultDiscountValue.toString(),
      items: promotion.items.map((item) => ({
        ...item,
        discountValue: item.discountValue?.toString() ?? null,
        variant: this.serializeVariantSnapshot(item.variant),
      })),
    };
  }

  private async serializePublicVariants(variants: PublicVariant[]) {
    const pricingMap =
      await this.pricingService.resolveVariantPricingMap(variants);

    return Promise.all(
      variants.map(async (variant) => {
        const pricing = pricingMap.get(variant.id)!;
        const tax = await this.taxService.resolveEffectiveTax({
          categoryId: variant.categoryId,
          productId: variant.productId,
          variantId: variant.id,
        });
        const taxAmount = pricing.effectivePrice
          .times(tax.taxPercent)
          .div(100)
          .toDecimalPlaces(2);

        return {
          ...this.serializeVariantSnapshot(variant),
          effectiveImageUrls:
            variant.imageUrls.length > 0
              ? variant.imageUrls
              : variant.product.imageUrls,
          tax: {
            source: tax.scope,
            targetId: tax.targetId,
            percent: tax.taxPercent.toString(),
          },
          pricing: {
            ...this.pricingService.serializePricing(pricing),
            taxAmount: taxAmount.toString(),
            totalWithTax: pricing.effectivePrice.plus(taxAmount).toString(),
          },
        };
      }),
    );
  }

  private serializeVariantSnapshot(variant: PublicVariant) {
    return {
      ...variant,
      price: variant.price.toString(),
      costPrice: variant.costPrice.toString(),
      salePrice: variant.salePrice?.toString() ?? null,
      discountPercent: variant.discountPercent?.toString() ?? null,
      taxPercent: variant.taxPercent?.toString() ?? null,
      score: variant.score.toString(),
      ratingAverage: variant.ratingAverage.toString(),
      ratingTotal: variant.ratingTotal.toString(),
    };
  }
}
