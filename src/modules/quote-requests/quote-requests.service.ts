import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  Prisma,
  ProductStatus,
  QuoteRequestStatus,
  VariantPricingStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { JwtUserPayload } from '../auth/auth.types';
import { MailService } from '../mail/mail.service';
import { normalizeVietnamPhoneNumber } from '../../common/vietnam-phone';
import { CreateQuoteRequestDto } from './create-quote-request.dto';
import { ListQuoteRequestsQuery } from './list-quote-requests.query';
import { UpdateQuoteRequestStatusDto } from './update-quote-request-status.dto';

type QuoteRequestWithRelations = Prisma.QuoteRequestGetPayload<{
  include: {
    product: true;
    variant: true;
    claimedByStaff: {
      select: {
        id: true;
        fullName: true;
        email: true;
      };
    };
  };
}>;

@Injectable()
export class QuoteRequestsService {
  private readonly pendingRequestLimit = 10;
  private readonly dailyDistinctProductLimit = 10;
  private readonly sameProductPendingLimit = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
    private readonly mailService: MailService,
  ) {}

  async create(data: CreateQuoteRequestDto, authorization?: string) {
    const variantIds = [...new Set(data.variantIds)];
    if (variantIds.length !== data.variantIds.length) {
      throw new BadRequestException('Variant ids must be unique');
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedPhone = normalizeVietnamPhoneNumber(data.phoneNumber);
    if (!normalizedPhone) {
      throw new BadRequestException('Phone number is required');
    }

    const [authenticatedUserId, emailOwner] = await Promise.all([
      this.resolveOptionalUserId(authorization),
      this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, active: true },
      }),
    ]);
    const userId = authenticatedUserId ?? emailOwner?.id ?? null;

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });

    if (variants.length !== variantIds.length) {
      throw new NotFoundException('Some quote request variants were not found');
    }

    this.assertContactForPriceVariants(variants);
    const productIds = variants.map((variant) => variant.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Each product can only appear once in a quote request group',
      );
    }

    await this.assertSpamLimits({
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      productIds,
      incomingCount: variants.length,
    });

    const requestGroupCode = this.generateRequestCode('RFQG');
    const created = await this.prisma.$transaction(
      variants.map((variant) =>
        this.prisma.quoteRequest.create({
          data: {
            requestCode: this.generateRequestCode('RFQ'),
            requestGroupCode,
            userId,
            productId: variant.productId,
            variantId: variant.id,
            customerName: data.fullName.trim(),
            customerEmail: normalizedEmail,
            customerPhone: normalizedPhone,
            quantity: data.quantity ?? 1,
            customerNote: data.note?.trim() || null,
          },
          include: this.quoteRequestInclude(),
        }),
      ),
    );

    await this.mailService.notifyQuoteRequestCreated(
      created.map((request) => request.id),
    );

    return {
      requestGroupCode,
      items: created.map((request) => this.serializeQuoteRequest(request)),
    };
  }

  async findAllForUser(userId: string, query: ListQuoteRequestsQuery) {
    const requests = await this.prisma.quoteRequest.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.quoteRequestInclude(),
    });

    return requests.map((request) => this.serializeQuoteRequest(request));
  }

  async findOneForUser(userId: string, requestId: string) {
    const request = await this.prisma.quoteRequest.findFirst({
      where: { id: requestId, userId },
      include: this.quoteRequestInclude(),
    });

    if (!request) {
      throw new NotFoundException('Quote request not found');
    }

    return this.serializeQuoteRequest(request);
  }

  async findAllForBackoffice(query: ListQuoteRequestsQuery) {
    const email = query.email?.trim().toLowerCase();
    const phoneNumber = normalizeVietnamPhoneNumber(query.phoneNumber);
    const requests = await this.prisma.quoteRequest.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.requestCode
          ? {
              OR: [
                { requestCode: { contains: query.requestCode.trim() } },
                { requestGroupCode: { contains: query.requestCode.trim() } },
              ],
            }
          : {}),
        ...(email ? { customerEmail: email } : {}),
        ...(phoneNumber ? { customerPhone: phoneNumber } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.quoteRequestInclude(),
    });

    return requests.map((request) => this.serializeQuoteRequest(request));
  }

  async findOneForBackoffice(requestId: string) {
    const request = await this.prisma.quoteRequest.findUnique({
      where: { id: requestId },
      include: this.quoteRequestInclude(),
    });

    if (!request) {
      throw new NotFoundException('Quote request not found');
    }

    return this.serializeQuoteRequest(request);
  }

  async claim(requestId: string, staffUserId: string, staffNote?: string) {
    const updated = await this.prisma.quoteRequest.updateMany({
      where: {
        id: requestId,
        status: QuoteRequestStatus.PENDING,
        claimedByStaffId: null,
      },
      data: {
        status: QuoteRequestStatus.QUOTED,
        claimedByStaffId: staffUserId,
        claimedAt: new Date(),
        quotedAt: new Date(),
        staffNote: staffNote?.trim() || null,
      },
    });

    if (updated.count !== 1) {
      const existing = await this.prisma.quoteRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, claimedByStaffId: true },
      });

      if (!existing) {
        throw new NotFoundException('Quote request not found');
      }

      throw new ConflictException(
        'Quote request has already been claimed or is no longer pending',
      );
    }

    await this.mailService.notifyQuoteRequestStatusChanged(requestId);
    return this.findOneForBackoffice(requestId);
  }

  async updateStatus(
    requestId: string,
    staffUserId: string,
    data: UpdateQuoteRequestStatusDto,
  ) {
    if (data.status === QuoteRequestStatus.QUOTED) {
      return this.claim(requestId, staffUserId, data.staffNote);
    }

    const request = await this.prisma.quoteRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        claimedByStaffId: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Quote request not found');
    }

    if (request.status === data.status) {
      await this.prisma.quoteRequest.update({
        where: { id: request.id },
        data: {
          staffNote: data.staffNote?.trim() || null,
        },
      });
      return this.findOneForBackoffice(request.id);
    }

    const now = new Date();
    await this.prisma.quoteRequest.update({
      where: { id: request.id },
      data: {
        status: data.status,
        staffNote: data.staffNote?.trim() || null,
        ...(data.status === QuoteRequestStatus.PENDING
          ? {
              claimedByStaffId: null,
              claimedAt: null,
              quotedAt: null,
              cancelledAt: null,
              closedAt: null,
            }
          : {}),
        ...(data.status === QuoteRequestStatus.CANCELLED
          ? { cancelledAt: now }
          : {}),
        ...(data.status === QuoteRequestStatus.CLOSED ? { closedAt: now } : {}),
      },
    });

    await this.mailService.notifyQuoteRequestStatusChanged(request.id);
    return this.findOneForBackoffice(request.id);
  }

  private async assertSpamLimits(input: {
    email: string;
    phoneNumber: string;
    productIds: string[];
    incomingCount: number;
  }) {
    const contactWhere = this.buildContactWhere(input.email, input.phoneNumber);
    const pendingCount = await this.prisma.quoteRequest.count({
      where: {
        status: QuoteRequestStatus.PENDING,
        OR: contactWhere,
      },
    });

    if (pendingCount + input.incomingCount > this.pendingRequestLimit) {
      throw new BadRequestException(
        'This email or phone number has too many pending quote requests. Please wait until previous requests are processed.',
      );
    }

    for (const productId of input.productIds) {
      const sameProductPendingCount = await this.prisma.quoteRequest.count({
        where: {
          productId,
          status: QuoteRequestStatus.PENDING,
          OR: contactWhere,
        },
      });

      if (sameProductPendingCount + 1 > this.sameProductPendingLimit) {
        throw new BadRequestException(
          'This email or phone number has requested this product too many times while previous requests are pending.',
        );
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRequests = await this.prisma.quoteRequest.findMany({
      where: {
        createdAt: { gte: todayStart },
        OR: contactWhere,
      },
      select: { productId: true },
    });
    const dailyProductIds = new Set(
      todayRequests.map((request) => request.productId),
    );

    for (const productId of input.productIds) {
      dailyProductIds.add(productId);
    }

    if (dailyProductIds.size > this.dailyDistinctProductLimit) {
      throw new BadRequestException(
        'This email or phone number can request quotes for at most 10 different products per day.',
      );
    }
  }

  private assertContactForPriceVariants(
    variants: Array<
      Prisma.ProductVariantGetPayload<{ include: { product: true } }>
    >,
  ) {
    for (const variant of variants) {
      if (!variant.active || !variant.product.active) {
        throw new BadRequestException('Variant is not available');
      }

      if (variant.product.status !== ProductStatus.PUBLISHED) {
        throw new BadRequestException('Product is not published');
      }

      if (variant.pricingStatus !== VariantPricingStatus.CONTACT_FOR_PRICE) {
        throw new BadRequestException(
          'Quote requests are only available for contact-for-price products',
        );
      }
    }
  }

  private async resolveOptionalUserId(authorization?: string) {
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

  private buildContactWhere(email: string, phoneNumber: string) {
    return [{ customerEmail: email }, { customerPhone: phoneNumber }];
  }

  private quoteRequestInclude() {
    return {
      product: true,
      variant: true,
      claimedByStaff: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    } satisfies Prisma.QuoteRequestInclude;
  }

  private generateRequestCode(prefix: string) {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(now.getDate()).padStart(2, '0')}`;
    return `${prefix}${date}${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private serializeQuoteRequest(request: QuoteRequestWithRelations) {
    return {
      ...request,
      variant: {
        ...request.variant,
        price: request.variant.price.toString(),
        costPrice: request.variant.costPrice.toString(),
        salePrice: request.variant.salePrice?.toString() ?? null,
        discountPercent: request.variant.discountPercent?.toString() ?? null,
        taxPercent: request.variant.taxPercent?.toString() ?? null,
        score: request.variant.score.toString(),
      },
    };
  }
}
