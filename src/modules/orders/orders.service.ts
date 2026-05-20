import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { JwtUserPayload } from '../auth/auth.types';
import { PaymentService } from '../payment/payment.service';
import { TaxService } from '../tax/tax.service';
import { CheckoutAddressDto } from './checkout-address.dto';
import { CreateCheckoutOrderDto } from './create-checkout-order.dto';
import { InvoiceAddressDto } from './invoice-address.dto';
import { ListOrdersQuery } from './list-orders.query';
import { PreviewCheckoutDto } from './preview-checkout.dto';
import { PublicOrderLookupQuery } from './public-order-lookup.query';
import { ReviewPaymentDto } from './review-payment.dto';
import { UpdateFulfillmentDto } from './update-fulfillment.dto';

type CartItemWithVariant = Prisma.CartItemGetPayload<{
  include: {
    product: true;
    variant: {
      include: {
        product: true;
      };
    };
  };
}>;

type PreviewIssue = {
  code: string;
  severity: 'warning' | 'error';
  message: string;
};

type PreviewItem = {
  cartItemId: string;
  productId: string;
  variantId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
  };
  variant: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    unit: string | null;
    imageUrl: string | null;
    stockQuantity: number;
    minOrderQuantity: number;
  };
  pricing: {
    price: Prisma.Decimal;
    salePrice: Prisma.Decimal | null;
    effectivePrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    taxPercent: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    total: Prisma.Decimal;
  };
  issues: PreviewIssue[];
};

type CheckoutIdentityInput = {
  authorization?: string;
  cartToken?: string;
};

type CheckoutOwner = {
  userId?: string;
  guestToken?: string;
  isGuest: boolean;
};

type CheckoutAddressSnapshot = {
  id?: string | null;
  name: string;
  phoneNumber?: string | null;
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  streetAddress: string;
  note?: string | null;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxService: TaxService,
    private readonly paymentService: PaymentService,
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
  ) {}

  async preview(identity: CheckoutIdentityInput, data: PreviewCheckoutDto) {
    const owner = await this.resolveCheckoutOwner(identity);
    const items = await this.buildPreviewItems(owner, data.cartItemIds);
    return this.buildPreviewResponse(items, {
      voucherCode: null,
      discountAmount: new Prisma.Decimal(0),
    });
  }

  async createCheckoutOrder(
    identity: CheckoutIdentityInput,
    data: CreateCheckoutOrderDto,
  ) {
    const owner = await this.resolveCheckoutOwner(identity);
    const [items, shippingAddress, user] = await Promise.all([
      this.buildPreviewItems(owner, data.cartItemIds),
      this.resolveShippingAddress(owner, data),
      owner.userId
        ? this.prisma.user.findUnique({
            where: { id: owner.userId },
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          })
        : null,
    ]);

    const preview = this.buildPreviewResponse(items, {
      voucherCode: data.voucherCode?.trim() || null,
      discountAmount: new Prisma.Decimal(0),
    });

    if (!preview.canCheckout) {
      throw new BadRequestException(
        'Selected cart items cannot be checked out',
      );
    }

    const customerEmail = (data.customerEmail ?? user?.email)
      ?.trim()
      .toLowerCase();
    if (!customerEmail) {
      throw new BadRequestException('Customer email is required');
    }

    const invoiceSnapshot = await this.resolveInvoiceSnapshot(owner, data);
    const orderCode = this.generateOrderCode();
    const payment = await this.paymentService.buildVietQrPayment({
      orderCode,
      amount: preview.summary.grandTotalAmount,
    });

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const updated = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            stockQuantity: { gte: item.quantity },
            active: true,
          },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            `Variant ${item.variant.sku} does not have enough stock`,
          );
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          orderCode,
          userId: owner.userId ?? null,
          guestToken: owner.guestToken ?? null,
          customerName:
            data.customerName?.trim() ?? user?.fullName ?? shippingAddress.name,
          customerEmail,
          customerPhone:
            data.customerPhone?.trim() ??
            user?.phoneNumber ??
            shippingAddress.phoneNumber,
          shippingAddressId: shippingAddress.id ?? null,
          shippingName: shippingAddress.name,
          shippingPhone: shippingAddress.phoneNumber,
          shippingProvinceCode: shippingAddress.provinceCode,
          shippingProvinceName: shippingAddress.provinceName,
          shippingWardCode: shippingAddress.wardCode,
          shippingWardName: shippingAddress.wardName,
          shippingStreetAddress: shippingAddress.streetAddress,
          shippingNote: shippingAddress.note,
          invoiceRequested: data.invoiceRequested ?? false,
          ...invoiceSnapshot,
          voucherCode: data.voucherCode?.trim() || null,
          subtotalAmount: preview.summary.subtotalAmount,
          taxAmount: preview.summary.taxAmount,
          shippingFee: preview.summary.shippingFee,
          discountAmount: preview.summary.discountAmount,
          grandTotalAmount: preview.summary.grandTotalAmount,
          paymentMethod: PaymentMethod.BANK_TRANSFER_QR,
          paymentProvider: payment.paymentProvider,
          paymentQrUrl: payment.paymentQrUrl,
          paymentBankCode: payment.paymentBankCode,
          paymentBankName: payment.paymentBankName,
          paymentBankAccountNumber: payment.paymentBankAccountNumber,
          paymentBankAccountName: payment.paymentBankAccountName,
          paymentTransferContent: payment.paymentTransferContent,
          customerNote: data.customerNote?.trim() || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productNameSnapshot: item.product.name,
              variantNameSnapshot: item.variant.name,
              skuSnapshot: item.variant.sku,
              imageUrlSnapshot: item.variant.imageUrl,
              unitSnapshot: item.variant.unit,
              quantity: item.quantity,
              priceSnapshot: item.pricing.price,
              salePriceSnapshot: item.pricing.salePrice,
              effectivePriceSnapshot: item.pricing.effectivePrice,
              taxPercentSnapshot: item.pricing.taxPercent,
              taxAmount: item.pricing.taxAmount,
              subtotalAmount: item.pricing.subtotal,
              totalAmount: item.pricing.total,
            })),
          },
        },
      });

      await tx.cartItem.deleteMany({
        where: {
          id: { in: data.cartItemIds },
          cart: this.resolveCartWhere(owner),
        },
      });

      return createdOrder;
    });

    if (owner.userId) {
      return this.findOneForUser(owner.userId, order.id);
    }

    return this.findPublicByOrderCodeAndEmail({
      orderCode: order.orderCode,
      email: customerEmail,
    });
  }

  async findAllForUser(userId: string, query: ListOrdersQuery) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
        ...(query.fulfillmentStatus
          ? { fulfillmentStatus: query.fulfillmentStatus }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async findOneForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.serializeOrder(order);
  }

  async findPublicByOrderCodeAndEmail(query: PublicOrderLookupQuery) {
    const order = await this.prisma.order.findFirst({
      where: {
        orderCode: query.orderCode.trim(),
        customerEmail: query.email.trim().toLowerCase(),
      },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.serializeOrder(order);
  }

  async confirmPaymentByUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.PENDING_PAYMENT ||
      order.paymentStatus !== PaymentStatus.WAITING_CUSTOMER_TRANSFER
    ) {
      throw new BadRequestException(
        'Order is not waiting for customer payment',
      );
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_REVIEW,
        paymentStatus: PaymentStatus.CUSTOMER_CONFIRMED,
        paymentConfirmedByUserAt: new Date(),
      },
    });

    return this.findOneForUser(userId, order.id);
  }

  async confirmPaymentByLookup(query: PublicOrderLookupQuery) {
    const order = await this.prisma.order.findFirst({
      where: {
        orderCode: query.orderCode.trim(),
        customerEmail: query.email.trim().toLowerCase(),
      },
      select: {
        id: true,
        orderCode: true,
        customerEmail: true,
        status: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.PENDING_PAYMENT ||
      order.paymentStatus !== PaymentStatus.WAITING_CUSTOMER_TRANSFER
    ) {
      throw new BadRequestException(
        'Order is not waiting for customer payment',
      );
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_REVIEW,
        paymentStatus: PaymentStatus.CUSTOMER_CONFIRMED,
        paymentConfirmedByUserAt: new Date(),
      },
    });

    return this.findPublicByOrderCodeAndEmail({
      orderCode: order.orderCode,
      email: order.customerEmail!,
    });
  }

  async findAllForBackoffice(query: ListOrdersQuery) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
        ...(query.fulfillmentStatus
          ? { fulfillmentStatus: query.fulfillmentStatus }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async findOneForBackoffice(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.serializeOrder(order);
  }

  async reviewPayment(
    orderId: string,
    staffUserId: string,
    data: ReviewPaymentDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const paymentReviewableStatuses: OrderStatus[] = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAYMENT_REVIEW,
    ];

    if (!paymentReviewableStatuses.includes(order.status)) {
      throw new BadRequestException('Order payment cannot be reviewed now');
    }

    if (data.action === 'APPROVE') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          paymentVerifiedAt: new Date(),
          paymentVerifiedByStaffId: staffUserId,
          paymentRejectReason: null,
          staffNote: data.staffNote?.trim() || order.staffNote,
        },
      });
      return this.findOneForBackoffice(order.id);
    }

    if (!data.rejectReason?.trim()) {
      throw new BadRequestException('Payment reject reason is required');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: { increment: item.quantity },
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          paymentStatus: PaymentStatus.REJECTED,
          paymentRejectReason: data.rejectReason!.trim(),
          staffNote: data.staffNote?.trim() || order.staffNote,
        },
      });
    });

    return this.findOneForBackoffice(order.id);
  }

  async updateFulfillment(orderId: string, data: UpdateFulfillmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        status: true,
        staffNote: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('Only paid orders can be fulfilled');
    }

    const terminalStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
      OrderStatus.COMPLETED,
    ];

    if (terminalStatuses.includes(order.status)) {
      throw new BadRequestException('Order fulfillment cannot be updated now');
    }

    const orderStatus = this.mapFulfillmentToOrderStatus(
      data.fulfillmentStatus,
    );

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: data.fulfillmentStatus,
        status: orderStatus,
        completedAt:
          data.fulfillmentStatus === FulfillmentStatus.DELIVERED
            ? new Date()
            : null,
        staffNote: data.staffNote?.trim() || order.staffNote,
      },
    });

    return this.findOneForBackoffice(order.id);
  }

  private async buildPreviewItems(owner: CheckoutOwner, cartItemIds: string[]) {
    const uniqueCartItemIds = [...new Set(cartItemIds)];
    if (uniqueCartItemIds.length !== cartItemIds.length) {
      throw new BadRequestException('Cart item ids must be unique');
    }

    const cart = await this.prisma.cart.findUnique({
      where: owner.userId
        ? { userId: owner.userId }
        : { guestToken: owner.guestToken },
      include: {
        items: {
          where: { id: { in: uniqueCartItemIds } },
          include: {
            product: true,
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!cart || cart.items.length !== uniqueCartItemIds.length) {
      throw new BadRequestException('Some cart items were not found');
    }

    const itemMap = new Map(cart.items.map((item) => [item.id, item]));
    const orderedItems = uniqueCartItemIds.map((id) => itemMap.get(id)!);

    return Promise.all(orderedItems.map((item) => this.buildPreviewItem(item)));
  }

  private async buildPreviewItem(
    item: CartItemWithVariant,
  ): Promise<PreviewItem> {
    const issues: PreviewIssue[] = [];
    const variant = item.variant;
    const effectivePrice = this.resolveEffectivePrice(variant);
    const subtotal = effectivePrice.times(item.quantity).toDecimalPlaces(2);
    const tax = await this.taxService.resolveEffectiveTax({
      categoryId: variant.categoryId,
      productId: item.productId,
      variantId: item.variantId,
    });
    const taxAmount = subtotal
      .times(tax.taxPercent)
      .div(100)
      .toDecimalPlaces(2);
    const total = subtotal.plus(taxAmount).toDecimalPlaces(2);

    if (!variant.active || !variant.product.active) {
      issues.push({
        code: 'VARIANT_UNAVAILABLE',
        severity: 'error',
        message: 'Variant is not available',
      });
    }

    if (variant.product.status !== 'PUBLISHED') {
      issues.push({
        code: 'PRODUCT_NOT_PUBLISHED',
        severity: 'error',
        message: 'Product is not published',
      });
    }

    if (variant.stockQuantity <= 0) {
      issues.push({
        code: 'OUT_OF_STOCK',
        severity: 'error',
        message: 'Variant is out of stock',
      });
    }

    if (item.quantity > variant.stockQuantity) {
      issues.push({
        code: 'QUANTITY_EXCEEDS_STOCK',
        severity: 'error',
        message: `Quantity cannot exceed available stock (${variant.stockQuantity})`,
      });
    }

    if (item.quantity < variant.minOrderQuantity) {
      issues.push({
        code: 'QUANTITY_BELOW_MIN_ORDER',
        severity: 'error',
        message: `Quantity cannot be lower than minimum order quantity (${variant.minOrderQuantity})`,
      });
    }

    if (!item.effectivePriceSnapshot.equals(effectivePrice)) {
      issues.push({
        code: 'PRICE_CHANGED',
        severity: 'warning',
        message: 'Item price changed after it was added to cart',
      });
    }

    return {
      cartItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
      },
      variant: {
        id: variant.id,
        name: variant.name,
        slug: variant.slug,
        sku: variant.sku,
        unit: variant.unit,
        imageUrl: variant.imageUrls[0] ?? variant.product.imageUrls[0] ?? null,
        stockQuantity: variant.stockQuantity,
        minOrderQuantity: variant.minOrderQuantity,
      },
      pricing: {
        price: variant.price,
        salePrice: variant.salePrice,
        effectivePrice,
        subtotal,
        taxPercent: tax.taxPercent,
        taxAmount,
        total,
      },
      issues,
    };
  }

  private buildPreviewResponse(
    items: PreviewItem[],
    options: { voucherCode: string | null; discountAmount: Prisma.Decimal },
  ) {
    const subtotalAmount = items.reduce(
      (total, item) => total.plus(item.pricing.subtotal),
      new Prisma.Decimal(0),
    );
    const taxAmount = items.reduce(
      (total, item) => total.plus(item.pricing.taxAmount),
      new Prisma.Decimal(0),
    );
    const shippingFee = new Prisma.Decimal(0);
    const discountAmount = options.discountAmount;
    const grandTotalAmount = subtotalAmount
      .plus(taxAmount)
      .plus(shippingFee)
      .minus(discountAmount)
      .toDecimalPlaces(2);
    const canCheckout = items.every((item) =>
      item.issues.every((issue) => issue.severity !== 'error'),
    );

    return {
      canCheckout,
      items: items.map((item) => ({
        ...item,
        pricing: this.serializePricing(item.pricing),
      })),
      voucher: options.voucherCode
        ? {
            code: options.voucherCode,
            discountAmount: discountAmount.toString(),
            supported: false,
            message: 'Voucher module is not enabled yet',
          }
        : null,
      summary: {
        itemCount: items.length,
        totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
        subtotalAmount,
        taxAmount,
        shippingFee,
        discountAmount,
        grandTotalAmount,
      },
    };
  }

  private async findUserAddress(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  private async resolveShippingAddress(
    owner: CheckoutOwner,
    data: CreateCheckoutOrderDto,
  ): Promise<CheckoutAddressSnapshot> {
    if (data.shippingAddressId) {
      if (!owner.userId) {
        throw new BadRequestException(
          'Guest checkout must provide shippingAddress',
        );
      }

      return this.findUserAddress(owner.userId, data.shippingAddressId);
    }

    if (data.shippingAddress) {
      return this.normalizeCheckoutAddress(data.shippingAddress);
    }

    throw new BadRequestException('Shipping address is required');
  }

  private async resolveInvoiceSnapshot(
    owner: CheckoutOwner,
    data: CreateCheckoutOrderDto,
  ) {
    if (!data.invoiceRequested) {
      return {};
    }

    if (data.invoiceAddressId) {
      if (!owner.userId) {
        throw new BadRequestException(
          'Guest checkout must provide invoiceAddress',
        );
      }

      const invoiceAddress = await this.findUserAddress(
        owner.userId,
        data.invoiceAddressId,
      );
      return {
        invoiceAddressId: invoiceAddress.id,
        invoiceName: invoiceAddress.name,
        invoicePhone: invoiceAddress.phoneNumber,
        invoiceProvinceCode: invoiceAddress.provinceCode,
        invoiceProvinceName: invoiceAddress.provinceName,
        invoiceWardCode: invoiceAddress.wardCode,
        invoiceWardName: invoiceAddress.wardName,
        invoiceStreetAddress: invoiceAddress.streetAddress,
      };
    }

    if (data.invoiceAddress) {
      return this.normalizeInvoiceAddress(data.invoiceAddress);
    }

    throw new BadRequestException(
      'Invoice address is required when invoiceRequested is true',
    );
  }

  private normalizeInvoiceAddress(data: InvoiceAddressDto) {
    return {
      invoiceName: data.name.trim(),
      invoicePhone: data.phone?.trim() || null,
      invoiceCompanyName: data.companyName?.trim() || null,
      invoiceTaxCode: data.taxCode?.trim() || null,
      invoiceEmail: data.email?.trim() || null,
      invoiceProvinceCode: data.provinceCode.trim(),
      invoiceProvinceName: data.provinceName.trim(),
      invoiceWardCode: data.wardCode.trim(),
      invoiceWardName: data.wardName.trim(),
      invoiceStreetAddress: data.streetAddress.trim(),
    };
  }

  private normalizeCheckoutAddress(
    data: CheckoutAddressDto,
  ): CheckoutAddressSnapshot {
    return {
      id: null,
      name: data.name.trim(),
      phoneNumber: data.phoneNumber?.trim() || null,
      provinceCode: data.provinceCode.trim(),
      provinceName: data.provinceName.trim(),
      wardCode: data.wardCode.trim(),
      wardName: data.wardName.trim(),
      streetAddress: data.streetAddress.trim(),
      note: data.note?.trim() || null,
    };
  }

  private async resolveCheckoutOwner(identity: CheckoutIdentityInput) {
    const userId = await this.resolveUserId(identity.authorization);

    if (userId) {
      return {
        userId,
        isGuest: false,
      } satisfies CheckoutOwner;
    }

    const guestToken = identity.cartToken?.trim();
    if (!guestToken) {
      throw new UnauthorizedException(
        'Missing access token or guest cart token',
      );
    }

    const cart = await this.prisma.cart.findUnique({
      where: { guestToken },
      select: { guestToken: true },
    });

    if (!cart) {
      throw new NotFoundException('Guest cart not found');
    }

    return {
      guestToken,
      isGuest: true,
    } satisfies CheckoutOwner;
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
        select: { id: true, active: true },
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

  private resolveCartWhere(owner: CheckoutOwner) {
    return owner.userId
      ? { userId: owner.userId }
      : { guestToken: owner.guestToken };
  }

  private generateOrderCode() {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(now.getDate()).padStart(2, '0')}`;
    return `DH${date}${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private resolveEffectivePrice(
    variant: Pick<
      Prisma.ProductVariantGetPayload<object>,
      'price' | 'salePrice' | 'discountPercent'
    >,
  ) {
    if (variant.salePrice) {
      return variant.salePrice;
    }

    if (variant.discountPercent && !variant.discountPercent.isZero()) {
      return variant.price
        .times(new Prisma.Decimal(100).minus(variant.discountPercent))
        .div(100)
        .toDecimalPlaces(2);
    }

    return variant.price;
  }

  private mapFulfillmentToOrderStatus(status: FulfillmentStatus) {
    switch (status) {
      case FulfillmentStatus.PROCESSING:
        return OrderStatus.PROCESSING;
      case FulfillmentStatus.READY_TO_SHIP:
        return OrderStatus.READY_TO_SHIP;
      case FulfillmentStatus.SHIPPING:
        return OrderStatus.SHIPPING;
      case FulfillmentStatus.DELIVERED:
        return OrderStatus.COMPLETED;
      case FulfillmentStatus.FAILED:
      case FulfillmentStatus.RETURNED:
        return OrderStatus.PROCESSING;
      case FulfillmentStatus.NOT_STARTED:
      default:
        return OrderStatus.CONFIRMED;
    }
  }

  private serializePricing(pricing: PreviewItem['pricing']) {
    return {
      price: pricing.price.toString(),
      salePrice: pricing.salePrice?.toString() ?? null,
      effectivePrice: pricing.effectivePrice.toString(),
      subtotal: pricing.subtotal.toString(),
      taxPercent: pricing.taxPercent.toString(),
      taxAmount: pricing.taxAmount.toString(),
      total: pricing.total.toString(),
    };
  }

  private serializeOrder(
    order: Prisma.OrderGetPayload<{ include: { items: true } }>,
  ) {
    return {
      ...order,
      subtotalAmount: order.subtotalAmount.toString(),
      taxAmount: order.taxAmount.toString(),
      shippingFee: order.shippingFee.toString(),
      discountAmount: order.discountAmount.toString(),
      grandTotalAmount: order.grandTotalAmount.toString(),
      items: order.items.map((item) => ({
        ...item,
        priceSnapshot: item.priceSnapshot.toString(),
        salePriceSnapshot: item.salePriceSnapshot?.toString() ?? null,
        effectivePriceSnapshot: item.effectivePriceSnapshot.toString(),
        taxPercentSnapshot: item.taxPercentSnapshot.toString(),
        taxAmount: item.taxAmount.toString(),
        subtotalAmount: item.subtotalAmount.toString(),
        totalAmount: item.totalAmount.toString(),
      })),
    };
  }
}
