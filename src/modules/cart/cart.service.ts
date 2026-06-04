import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { JwtUserPayload } from '../auth/auth.types';
import { TaxService } from '../tax/tax.service';
import { AddCartItemDto } from './add-cart-item.dto';
import { UpdateCartItemDto } from './update-cart-item.dto';
import { PricingService } from '../pricing/pricing.service';

type CartIdentityInput = {
  authorization?: string;
  cartToken?: string;
};

type CartOwner = {
  userId?: string;
  guestToken?: string;
  isGuest: boolean;
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
    private readonly taxService: TaxService,
    private readonly pricingService: PricingService,
  ) {}

  async findCurrent(identity: CartIdentityInput) {
    const { cart, owner } = await this.getOrCreateCart(identity);
    return this.buildCartResponse(cart.id, owner);
  }

  async addItem(data: AddCartItemDto, identity: CartIdentityInput) {
    const { cart, owner } = await this.getOrCreateCart(identity);
    const variant = await this.findPurchasableVariant(data.variantId);
    const pricing = await this.pricingService.resolveVariantPricing(variant);

    await this.prisma.$transaction(async (tx) => {
      const existingItem = await tx.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: cart.id,
            variantId: variant.id,
          },
        },
        select: {
          id: true,
          quantity: true,
        },
      });

      if (existingItem) {
        const nextQuantity = existingItem.quantity + 1;
        this.ensureQuantityDoesNotExceedStock(
          nextQuantity,
          variant.stockQuantity,
        );

        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: nextQuantity },
        });
        return;
      }

      const initialQuantity = variant.minOrderQuantity;
      this.ensureQuantityDoesNotExceedStock(
        initialQuantity,
        variant.stockQuantity,
      );

      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: variant.productId,
          variantId: variant.id,
          quantity: initialQuantity,
          productNameSnapshot: variant.product.name,
          variantNameSnapshot: variant.name,
          priceSnapshot: variant.price,
          salePriceSnapshot: variant.salePrice,
          effectivePriceSnapshot: pricing.effectivePrice,
          imageUrlSnapshot: this.resolveImageUrlSnapshot(variant),
        },
      });
    });

    return this.buildCartResponse(cart.id, owner);
  }

  async updateItem(
    itemId: string,
    data: UpdateCartItemDto,
    identity: CartIdentityInput,
  ) {
    const { cart, owner } = await this.getOrCreateCart(identity);
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    this.ensureVariantCanStayInCart(item.variant);
    if (data.quantity < item.variant.minOrderQuantity) {
      throw new BadRequestException(
        `Quantity cannot be lower than minimum order quantity (${item.variant.minOrderQuantity})`,
      );
    }
    this.ensureQuantityDoesNotExceedStock(
      data.quantity,
      item.variant.stockQuantity,
    );

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: data.quantity },
    });

    return this.buildCartResponse(cart.id, owner);
  }

  async removeItem(itemId: string, identity: CartIdentityInput) {
    const { cart, owner } = await this.getOrCreateCart(identity);
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
      select: {
        id: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: item.id },
    });

    return this.buildCartResponse(cart.id, owner);
  }

  async clear(identity: CartIdentityInput) {
    const { cart, owner } = await this.getOrCreateCart(identity);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.buildCartResponse(cart.id, owner);
  }

  private async getOrCreateCart(identity: CartIdentityInput) {
    const userId = await this.resolveUserId(identity.authorization);

    if (userId) {
      const cart = await this.prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true, userId: true, guestToken: true },
      });

      return {
        cart,
        owner: {
          userId,
          isGuest: false,
        } satisfies CartOwner,
      };
    }

    const guestToken = identity.cartToken?.trim() || randomUUID();
    const cart = await this.prisma.cart.upsert({
      where: { guestToken },
      update: {},
      create: { guestToken },
      select: { id: true, userId: true, guestToken: true },
    });

    return {
      cart,
      owner: {
        guestToken: cart.guestToken ?? guestToken,
        isGuest: true,
      } satisfies CartOwner,
    };
  }

  private async resolveUserId(authorization?: string) {
    const token = this.extractBearerToken(authorization);

    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(token, {
        secret: this.authConfigService.accessSecret,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          active: true,
        },
      });

      if (!user || !user.active) {
        throw new UnauthorizedException('User is inactive');
      }

      return user.id;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractBearerToken(header?: string): string | null {
    if (!header) {
      return null;
    }

    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private async findPurchasableVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    this.ensureVariantCanStayInCart(variant);
    if (variant.stockQuantity <= 0) {
      throw new BadRequestException('Variant is out of stock');
    }

    return variant;
  }

  private ensureVariantCanStayInCart(
    variant: Prisma.ProductVariantGetPayload<{
      include: { product: true };
    }>,
  ) {
    if (!variant.active || !variant.product.active) {
      throw new BadRequestException('Variant is not available');
    }

    if (variant.product.status !== 'PUBLISHED') {
      throw new BadRequestException('Product is not published');
    }

    if (variant.pricingStatus === 'CONTACT_FOR_PRICE') {
      throw new BadRequestException('Variant requires a custom quote');
    }
  }

  private ensureQuantityDoesNotExceedStock(quantity: number, stock: number) {
    if (quantity > stock) {
      throw new BadRequestException(
        `Quantity cannot exceed available stock (${stock})`,
      );
    }
  }

  private async buildCartResponse(cartId: string, owner: CartOwner) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: true,
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const tax = await this.taxService.resolveEffectiveTax({
          categoryId: item.variant.categoryId,
          productId: item.productId,
          variantId: item.variantId,
        });
        const pricing = await this.pricingService.resolveVariantPricing(
          item.variant,
        );
        const currentEffectivePrice = pricing.effectivePrice;
        const snapshotSubtotal = item.effectivePriceSnapshot.times(
          item.quantity,
        );
        const currentSubtotal = currentEffectivePrice.times(item.quantity);
        const currentTaxAmount = currentSubtotal
          .times(tax.taxPercent)
          .div(100)
          .toDecimalPlaces(2);
        const currentTotalWithTax = currentSubtotal.plus(currentTaxAmount);
        const priceChanged = !item.effectivePriceSnapshot.equals(
          currentEffectivePrice,
        );
        const available =
          item.variant.active &&
          item.variant.product.active &&
          item.variant.product.status === 'PUBLISHED' &&
          item.variant.pricingStatus === 'HAS_PRICE' &&
          item.variant.stockQuantity > 0;

        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          minOrderQuantity: item.variant.minOrderQuantity,
          stockQuantity: item.variant.stockQuantity,
          available,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
          },
          variant: {
            id: item.variant.id,
            name: item.variant.name,
            slug: item.variant.slug,
            sku: item.variant.sku,
            unit: item.variant.unit,
            originCountryCode: item.variant.originCountryCode,
            pricingStatus: item.variant.pricingStatus,
            imageUrls: this.resolveEffectiveImageUrls(item.variant),
          },
          snapshot: {
            productName: item.productNameSnapshot,
            variantName: item.variantNameSnapshot,
            price: item.priceSnapshot.toString(),
            salePrice: item.salePriceSnapshot?.toString() ?? null,
            effectivePrice: item.effectivePriceSnapshot.toString(),
            imageUrl: item.imageUrlSnapshot,
            subtotal: snapshotSubtotal.toString(),
          },
          current: {
            price: item.variant.price.toString(),
            salePrice: item.variant.salePrice?.toString() ?? null,
            pricingStatus: item.variant.pricingStatus,
            effectivePrice: currentEffectivePrice.toString(),
            discountAmount: pricing.discountAmount.toString(),
            discount: this.pricingService.serializePricing(pricing).discount,
            subtotal: currentSubtotal.toString(),
            tax: {
              source: tax.scope,
              targetId: tax.targetId,
              percent: tax.taxPercent.toString(),
              amount: currentTaxAmount.toString(),
            },
            totalWithTax: currentTotalWithTax.toString(),
          },
          priceChanged,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
    );

    const subtotalSnapshot = items.reduce(
      (total, item) => total.plus(item.snapshot.subtotal),
      new Prisma.Decimal(0),
    );
    const subtotalCurrent = items.reduce(
      (total, item) => total.plus(item.current.subtotal),
      new Prisma.Decimal(0),
    );
    const taxTotalCurrent = items.reduce(
      (total, item) => total.plus(item.current.tax.amount),
      new Prisma.Decimal(0),
    );
    const totalCurrentWithTax = items.reduce(
      (total, item) => total.plus(item.current.totalWithTax),
      new Prisma.Decimal(0),
    );

    return {
      id: cart.id,
      userId: owner.userId ?? null,
      guestToken: owner.isGuest ? owner.guestToken : null,
      items,
      summary: {
        itemCount: items.length,
        totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
        subtotalSnapshot: subtotalSnapshot.toString(),
        subtotalCurrent: subtotalCurrent.toString(),
        taxTotalCurrent: taxTotalCurrent.toString(),
        totalCurrentWithTax: totalCurrentWithTax.toString(),
        priceChanged: items.some((item) => item.priceChanged),
      },
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private resolveImageUrlSnapshot(
    variant: Prisma.ProductVariantGetPayload<{
      include: { product: true };
    }>,
  ) {
    return variant.imageUrls[0] ?? variant.product.imageUrls[0] ?? null;
  }

  private resolveEffectiveImageUrls(
    variant: Prisma.ProductVariantGetPayload<{
      include: { product: true };
    }>,
  ) {
    return variant.imageUrls.length > 0
      ? variant.imageUrls
      : variant.product.imageUrls;
  }
}
