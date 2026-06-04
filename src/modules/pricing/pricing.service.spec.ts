import { Prisma, PromotionDiscountType } from '@prisma/client';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  function createService(promotionItems: unknown[]) {
    const prisma = {
      promotionItem: {
        findMany: jest.fn().mockResolvedValue(promotionItems),
      },
    };

    return {
      service: new PricingService(prisma as never),
      prisma,
    };
  }

  it('uses direct sale price when there is no active promotion', async () => {
    const { service } = createService([]);

    const pricing = await service.resolveVariantPricing({
      id: 'variant-1',
      price: new Prisma.Decimal(1000),
      salePrice: new Prisma.Decimal(900),
      discountPercent: null,
    });

    expect(pricing.effectivePrice.toString()).toBe('900');
    expect(pricing.discount?.source).toBe('VARIANT_SALE_PRICE');
  });

  it('chooses the active promotion with the highest discount', async () => {
    const now = new Date();
    const { service } = createService([
      {
        variantId: 'variant-1',
        discountType: PromotionDiscountType.PERCENT,
        discountValue: new Prisma.Decimal(10),
        promotion: {
          id: 'promotion-1',
          name: 'Promo 10',
          slug: 'promo-10',
          defaultDiscountType: PromotionDiscountType.PERCENT,
          defaultDiscountValue: new Prisma.Decimal(10),
          bannerImageUrl: null,
          bannerLinkUrl: null,
          startsAt: now,
          endsAt: null,
        },
      },
      {
        variantId: 'variant-1',
        discountType: PromotionDiscountType.PERCENT,
        discountValue: new Prisma.Decimal(25),
        promotion: {
          id: 'promotion-2',
          name: 'Promo 25',
          slug: 'promo-25',
          defaultDiscountType: PromotionDiscountType.PERCENT,
          defaultDiscountValue: new Prisma.Decimal(25),
          bannerImageUrl: null,
          bannerLinkUrl: null,
          startsAt: now,
          endsAt: null,
        },
      },
    ]);

    const pricing = await service.resolveVariantPricing({
      id: 'variant-1',
      price: new Prisma.Decimal(1000),
      salePrice: new Prisma.Decimal(850),
      discountPercent: null,
    });

    expect(pricing.effectivePrice.toString()).toBe('750');
    expect(pricing.discount?.source).toBe('PROMOTION');
    expect(pricing.discount?.promotion?.slug).toBe('promo-25');
  });
});
