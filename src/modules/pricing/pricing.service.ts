import { Injectable } from '@nestjs/common';
import { Prisma, PromotionDiscountType, PromotionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type PriceableVariant = Pick<
  Prisma.ProductVariantGetPayload<object>,
  'id' | 'price' | 'salePrice' | 'discountPercent'
>;

type ActivePromotionItem = Prisma.PromotionItemGetPayload<{
  include: {
    promotion: {
      select: {
        id: true;
        name: true;
        slug: true;
        defaultDiscountType: true;
        defaultDiscountValue: true;
        bannerImageUrl: true;
        bannerLinkUrl: true;
        startsAt: true;
        endsAt: true;
      };
    };
  };
}>;

export type VariantDiscountSource =
  | 'VARIANT_SALE_PRICE'
  | 'VARIANT_DISCOUNT_PERCENT'
  | 'PROMOTION';

export type VariantPricing = {
  price: Prisma.Decimal;
  salePrice: Prisma.Decimal | null;
  discountPercent: Prisma.Decimal | null;
  effectivePrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discount: {
    source: VariantDiscountSource;
    type: 'SALE_PRICE' | PromotionDiscountType;
    value: Prisma.Decimal | null;
    promotion: {
      id: string;
      name: string;
      slug: string;
      bannerImageUrl: string | null;
      bannerLinkUrl: string | null;
      startsAt: Date;
      endsAt: Date | null;
    } | null;
  } | null;
};

type PricingCandidate = Pick<
  VariantPricing,
  'effectivePrice' | 'discountAmount' | 'discount'
>;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveVariantPricing(variant: PriceableVariant) {
    const promotionItems = await this.findActivePromotionItems([variant.id]);
    return this.buildVariantPricing(
      variant,
      promotionItems.get(variant.id) ?? [],
    );
  }

  async resolveVariantPricingMap<TVariant extends PriceableVariant>(
    variants: TVariant[],
  ) {
    const promotionItems = await this.findActivePromotionItems(
      variants.map((variant) => variant.id),
    );

    return new Map(
      variants.map((variant) => [
        variant.id,
        this.buildVariantPricing(variant, promotionItems.get(variant.id) ?? []),
      ]),
    );
  }

  serializePricing(pricing: VariantPricing) {
    return {
      effectivePrice: pricing.effectivePrice.toString(),
      discountAmount: pricing.discountAmount.toString(),
      discount: pricing.discount
        ? {
            source: pricing.discount.source,
            type: pricing.discount.type,
            value: pricing.discount.value?.toString() ?? null,
            promotion: pricing.discount.promotion,
          }
        : null,
    };
  }

  private async findActivePromotionItems(variantIds: string[]) {
    const uniqueVariantIds = [...new Set(variantIds)].filter(Boolean);
    const result = new Map<string, ActivePromotionItem[]>();

    if (uniqueVariantIds.length === 0) {
      return result;
    }

    const now = new Date();
    const items = await this.prisma.promotionItem.findMany({
      where: {
        variantId: { in: uniqueVariantIds },
        promotion: {
          status: PromotionStatus.ACTIVE,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      },
      include: {
        promotion: {
          select: {
            id: true,
            name: true,
            slug: true,
            defaultDiscountType: true,
            defaultDiscountValue: true,
            bannerImageUrl: true,
            bannerLinkUrl: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    for (const item of items) {
      const current = result.get(item.variantId) ?? [];
      current.push(item);
      result.set(item.variantId, current);
    }

    return result;
  }

  private buildVariantPricing(
    variant: PriceableVariant,
    promotionItems: ActivePromotionItem[],
  ): VariantPricing {
    const basePrice = variant.price.toDecimalPlaces(2);
    let best: PricingCandidate = {
      effectivePrice: basePrice,
      discountAmount: new Prisma.Decimal(0),
      discount: null,
    };

    if (variant.salePrice !== null) {
      best = this.chooseBestCandidate(best, {
        effectivePrice: variant.salePrice.toDecimalPlaces(2),
        discountAmount: this.resolveDiscountAmount(
          basePrice,
          variant.salePrice,
        ),
        discount: {
          source: 'VARIANT_SALE_PRICE',
          type: 'SALE_PRICE',
          value: variant.salePrice,
          promotion: null,
        },
      });
    } else if (
      variant.discountPercent !== null &&
      !variant.discountPercent.isZero()
    ) {
      best = this.chooseBestCandidate(
        best,
        this.buildPercentCandidate(
          basePrice,
          variant.discountPercent,
          'VARIANT_DISCOUNT_PERCENT',
          null,
        ),
      );
    }

    for (const item of promotionItems) {
      const discountType =
        item.discountType ?? item.promotion.defaultDiscountType;
      const discountValue =
        item.discountValue ?? item.promotion.defaultDiscountValue;
      const promotionSnapshot = {
        id: item.promotion.id,
        name: item.promotion.name,
        slug: item.promotion.slug,
        bannerImageUrl: item.promotion.bannerImageUrl,
        bannerLinkUrl: item.promotion.bannerLinkUrl,
        startsAt: item.promotion.startsAt,
        endsAt: item.promotion.endsAt,
      };

      const candidate =
        discountType === PromotionDiscountType.PERCENT
          ? this.buildPercentCandidate(
              basePrice,
              discountValue,
              'PROMOTION',
              promotionSnapshot,
            )
          : this.buildFixedAmountCandidate(
              basePrice,
              discountValue,
              promotionSnapshot,
            );

      best = this.chooseBestCandidate(best, candidate);
    }

    return {
      price: variant.price,
      salePrice: variant.salePrice,
      discountPercent: variant.discountPercent,
      effectivePrice: best.effectivePrice,
      discountAmount: best.discountAmount,
      discount: best.discount,
    };
  }

  private buildPercentCandidate(
    basePrice: Prisma.Decimal,
    rawPercent: Prisma.Decimal,
    source: VariantDiscountSource,
    promotion: NonNullable<VariantPricing['discount']>['promotion'],
  ): PricingCandidate {
    const percent = this.clampDecimal(
      rawPercent,
      new Prisma.Decimal(0),
      new Prisma.Decimal(100),
    );
    const discountAmount = basePrice.times(percent).div(100).toDecimalPlaces(2);
    const effectivePrice = basePrice.minus(discountAmount).toDecimalPlaces(2);

    return {
      effectivePrice,
      discountAmount,
      discount: {
        source,
        type: PromotionDiscountType.PERCENT,
        value: percent,
        promotion,
      },
    };
  }

  private buildFixedAmountCandidate(
    basePrice: Prisma.Decimal,
    rawAmount: Prisma.Decimal,
    promotion: NonNullable<VariantPricing['discount']>['promotion'],
  ): PricingCandidate {
    const amount = this.clampDecimal(
      rawAmount,
      new Prisma.Decimal(0),
      basePrice,
    );
    const effectivePrice = basePrice.minus(amount).toDecimalPlaces(2);

    return {
      effectivePrice,
      discountAmount: amount.toDecimalPlaces(2),
      discount: {
        source: 'PROMOTION',
        type: PromotionDiscountType.FIXED_AMOUNT,
        value: amount,
        promotion,
      },
    };
  }

  private chooseBestCandidate(
    current: PricingCandidate,
    candidate: PricingCandidate,
  ): PricingCandidate {
    if (candidate.effectivePrice.lt(current.effectivePrice)) {
      return candidate;
    }

    if (
      candidate.effectivePrice.equals(current.effectivePrice) &&
      candidate.discount?.source === 'PROMOTION' &&
      current.discount?.source !== 'PROMOTION'
    ) {
      return candidate;
    }

    return current;
  }

  private resolveDiscountAmount(
    basePrice: Prisma.Decimal,
    effectivePrice: Prisma.Decimal,
  ) {
    const amount = basePrice.minus(effectivePrice);
    return amount.gt(0) ? amount.toDecimalPlaces(2) : new Prisma.Decimal(0);
  }

  private clampDecimal(
    value: Prisma.Decimal,
    min: Prisma.Decimal,
    max: Prisma.Decimal,
  ) {
    if (value.lt(min)) {
      return min;
    }

    if (value.gt(max)) {
      return max;
    }

    return value;
  }
}
