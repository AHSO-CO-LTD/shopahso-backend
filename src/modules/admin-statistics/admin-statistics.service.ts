import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AppRole,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  QuoteRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminStatisticsQuery,
  StatisticsInterval,
  StatisticsPreset,
} from './admin-statistics.query';

type ResolvedRange = {
  from: Date;
  to: Date;
  interval: StatisticsInterval;
  topLimit: number;
};

type DateBucketRow = {
  bucket: Date;
  count?: bigint | number | null;
  total?: Prisma.Decimal | string | number | null;
};

type OrderSeriesRow = {
  bucket: Date;
  totalOrders: bigint | number;
  paidOrders: bigint | number;
  cancelledOrders: bigint | number;
};

type RevenueSeriesRow = {
  bucket: Date;
  revenue: Prisma.Decimal | string | number | null;
  orderCount: bigint | number;
};

type TopVariantRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  stockQuantity: bigint | number;
  isActive: boolean;
  pricingStatus: string;
  price: Prisma.Decimal | string | number | null;
  metric: bigint | number | Prisma.Decimal | string | null;
  quantity?: bigint | number | Prisma.Decimal | string | null;
  revenue?: bigint | number | Prisma.Decimal | string | null;
};

type AlertSeverity = 'info' | 'warning' | 'critical';

@Injectable()
export class AdminStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query: AdminStatisticsQuery) {
    const range = this.resolveRange(query);
    const previousRange = this.resolvePreviousRange(range);
    const [website, users, products, orders, quoteRequests, comparison] =
      await Promise.all([
        this.getWebsiteFromRange(range),
        this.getUsersFromRange(range),
        this.getProductsFromRange(range),
        this.getOrdersFromRange(range),
        this.getQuoteRequestsFromRange(range),
        this.getDashboardComparison(range, previousRange),
      ]);
    const rates = {
      paidOrderRate: orders.rates.paidOrderRate,
      cancellationRate: orders.rates.cancellationRate,
      quoteCompletionRate: quoteRequests.rates.quoteCompletionRate,
      outOfStockRate: products.rates.outOfStockRate,
      contactForPriceRate: products.rates.contactForPriceRate,
    };
    const alerts = this.buildDashboardAlerts({
      pendingQuoteRequests: quoteRequests.summary.pendingQuoteRequests,
      outOfStockVariants: products.summary.outOfStockVariants,
      unpaidOrders: orders.summary.unpaidOrders,
      cancelledOrders: orders.summary.cancelledOrders,
      draftProducts: products.summary.draftProducts,
      trackingAvailable: website.meta.trackingAvailable,
    });

    return {
      meta: this.buildMeta(range),
      comparison,
      summary: {
        registeredUsers: users.summary.totalUsers,
        newUsers: users.summary.newUsers,
        products: products.summary.totalProducts,
        newProducts: products.summary.newProducts,
        variants: products.summary.totalVariants,
        orders: orders.summary.totalOrders,
        paidOrders: orders.summary.paidOrders,
        revenue: orders.summary.revenue,
        quoteRequests: quoteRequests.summary.totalQuoteRequests,
        pendingQuoteRequests: quoteRequests.summary.pendingQuoteRequests,
        visits: website.summary.visits,
      },
      rates,
      alerts,
      cards: [
        this.card('registeredUsers', 'Người dùng', users.summary.totalUsers),
        this.card('newUsers', 'Người dùng mới', users.summary.newUsers),
        this.card('products', 'Sản phẩm', products.summary.totalProducts),
        this.card('variants', 'Biến thể', products.summary.totalVariants),
        this.card('orders', 'Đơn hàng', orders.summary.totalOrders),
        this.card('paidOrders', 'Đơn đã thanh toán', orders.summary.paidOrders),
        this.card('revenue', 'Doanh thu', orders.summary.revenue),
        this.card(
          'quoteRequests',
          'Yêu cầu báo giá',
          quoteRequests.summary.totalQuoteRequests,
        ),
      ],
      series: {
        users: users.series.newUsers,
        orders: orders.series.orders,
        revenue: orders.series.revenue,
        quoteRequests: quoteRequests.series.quoteRequests,
      },
      topItems: {
        viewedProducts: products.topItems.viewedVariants,
        purchasedProducts: products.topItems.purchasedVariants,
      },
      breakdowns: {
        orderStatus: orders.breakdowns.status,
        paymentStatus: orders.breakdowns.paymentStatus,
        fulfillmentStatus: orders.breakdowns.fulfillmentStatus,
        quoteRequestStatus: quoteRequests.breakdowns.status,
        userRoles: users.breakdowns.roles,
        stock: products.breakdowns.stock,
      },
      modules: {
        website,
        users,
        products,
        orders,
        quoteRequests,
      },
    };
  }

  getWebsite(query: AdminStatisticsQuery) {
    return this.getWebsiteFromRange(this.resolveRange(query));
  }

  getUsers(query: AdminStatisticsQuery) {
    return this.getUsersFromRange(this.resolveRange(query));
  }

  getProducts(query: AdminStatisticsQuery) {
    return this.getProductsFromRange(this.resolveRange(query));
  }

  getOrders(query: AdminStatisticsQuery) {
    return this.getOrdersFromRange(this.resolveRange(query));
  }

  getQuoteRequests(query: AdminStatisticsQuery) {
    return this.getQuoteRequestsFromRange(this.resolveRange(query));
  }

  private async getWebsiteFromRange(range: ResolvedRange) {
    const users = await this.getUsersFromRange(range);

    return {
      meta: {
        ...this.buildMeta(range),
        trackingAvailable: false,
        trackingMessage:
          'Chưa có bảng lưu website visits/sessions nên visits và sessions đang là null.',
      },
      summary: {
        totalUsers: users.summary.totalUsers,
        newUsers: users.summary.newUsers,
        activeUsers: users.summary.activeUsers,
        visits: null,
        sessions: null,
      },
      cards: [
        this.card('totalUsers', 'Tổng người dùng', users.summary.totalUsers),
        this.card('newUsers', 'Người dùng mới', users.summary.newUsers),
        this.card(
          'activeUsers',
          'Người dùng đang hoạt động',
          users.summary.activeUsers,
        ),
        this.card('visits', 'Lượt truy cập', null),
        this.card('sessions', 'Phiên truy cập', null),
      ],
      series: {
        newUsers: users.series.newUsers,
        visits: this.emptySeries('visits', 'Lượt truy cập'),
        sessions: this.emptySeries('sessions', 'Phiên truy cập'),
      },
    };
  }

  private async getUsersFromRange(range: ResolvedRange) {
    const [totalUsers, activeUsers, newUsers, roleBreakdown, newUserRows] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { active: true } }),
        this.prisma.user.count({
          where: { createdAt: { gte: range.from, lte: range.to } },
        }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { role: true },
          orderBy: { role: 'asc' },
        }),
        this.countByDate('users', 'created_at', range),
      ]);

    return {
      meta: this.buildMeta(range),
      summary: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        newUsers,
      },
      cards: [
        this.card('totalUsers', 'Tổng người dùng', totalUsers),
        this.card('activeUsers', 'Đang hoạt động', activeUsers),
        this.card('inactiveUsers', 'Tạm khóa', totalUsers - activeUsers),
        this.card('newUsers', 'Người dùng mới', newUsers),
      ],
      series: {
        newUsers: this.seriesFromRows(
          'newUsers',
          'Người dùng mới',
          newUserRows,
        ),
      },
      breakdowns: {
        roles: roleBreakdown.map((item) => ({
          key: item.role,
          label: this.labelRole(item.role),
          value: item._count.role,
        })),
      },
    };
  }

  private async getProductsFromRange(range: ResolvedRange) {
    const [
      totalProducts,
      activeProducts,
      publishedProducts,
      newProducts,
      totalVariants,
      activeVariants,
      newVariants,
      outOfStockVariants,
      contactForPriceVariants,
      viewedVariants,
      purchasedVariants,
      newProductRows,
      newVariantRows,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { active: true } }),
      this.prisma.product.count({ where: { status: ProductStatus.PUBLISHED } }),
      this.prisma.product.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.productVariant.count(),
      this.prisma.productVariant.count({ where: { active: true } }),
      this.prisma.productVariant.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.productVariant.count({
        where: { active: true, stockQuantity: { lte: 0 } },
      }),
      this.prisma.productVariant.count({
        where: { active: true, pricingStatus: 'CONTACT_FOR_PRICE' },
      }),
      this.findTopViewedVariants(range.topLimit),
      this.findTopPurchasedVariants(range),
      this.countByDate('products', 'created_at', range),
      this.countByDate('product_variants', 'created_at', range),
    ]);

    return {
      meta: this.buildMeta(range),
      summary: {
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
        publishedProducts,
        draftProducts: totalProducts - publishedProducts,
        newProducts,
        totalVariants,
        activeVariants,
        inactiveVariants: totalVariants - activeVariants,
        newVariants,
        outOfStockVariants,
        contactForPriceVariants,
      },
      rates: {
        outOfStockRate: this.resolveRate(outOfStockVariants, activeVariants),
        contactForPriceRate: this.resolveRate(
          contactForPriceVariants,
          activeVariants,
        ),
      },
      cards: [
        this.card('totalProducts', 'Tổng sản phẩm', totalProducts),
        this.card('newProducts', 'Sản phẩm mới', newProducts),
        this.card('totalVariants', 'Tổng biến thể', totalVariants),
        this.card('newVariants', 'Biến thể mới', newVariants),
        this.card('outOfStockVariants', 'Hết hàng', outOfStockVariants),
        this.card(
          'contactForPriceVariants',
          'Liên hệ báo giá',
          contactForPriceVariants,
        ),
      ],
      series: {
        newProducts: this.seriesFromRows(
          'newProducts',
          'Sản phẩm mới',
          newProductRows,
        ),
        newVariants: this.seriesFromRows(
          'newVariants',
          'Biến thể mới',
          newVariantRows,
        ),
      },
      breakdowns: {
        productStatus: [
          {
            key: ProductStatus.PUBLISHED,
            label: 'Đã xuất bản',
            value: publishedProducts,
          },
          {
            key: ProductStatus.DRAFT,
            label: 'Bản nháp',
            value: totalProducts - publishedProducts,
          },
        ],
        stock: [
          {
            key: 'inStock',
            label: 'Còn hàng',
            value: activeVariants - outOfStockVariants,
          },
          { key: 'outOfStock', label: 'Hết hàng', value: outOfStockVariants },
        ],
      },
      topItems: {
        viewedVariants: viewedVariants.map((item) =>
          this.serializeTopVariant(item, 'viewCount'),
        ),
        purchasedVariants: purchasedVariants.map((item) =>
          this.serializeTopVariant(item, 'purchasedQuantity'),
        ),
      },
    };
  }

  private async getOrdersFromRange(range: ResolvedRange) {
    const where = { createdAt: { gte: range.from, lte: range.to } };
    const paidWhere = {
      ...where,
      paymentStatus: PaymentStatus.PAID,
    };

    const [
      totalOrders,
      paidOrders,
      revenueAggregate,
      statusRows,
      paymentRows,
      fulfillmentRows,
      orderRows,
      revenueRows,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: paidWhere }),
      this.prisma.order.aggregate({
        where: paidWhere,
        _sum: { grandTotalAmount: true },
        _avg: { grandTotalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['paymentStatus'],
        where,
        _count: { paymentStatus: true },
        orderBy: { paymentStatus: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        where,
        _count: { fulfillmentStatus: true },
        orderBy: { fulfillmentStatus: 'asc' },
      }),
      this.getOrderSeriesRows(range),
      this.getRevenueSeriesRows(range),
    ]);
    const revenue = this.decimalToString(
      revenueAggregate._sum.grandTotalAmount,
    );
    const averageOrderValue = this.decimalToString(
      revenueAggregate._avg.grandTotalAmount,
    );
    const terminalCancelledStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
    ];
    const cancelledOrders = statusRows
      .filter((row) => terminalCancelledStatuses.includes(row.status))
      .reduce((total, row) => total + row._count.status, 0);

    return {
      meta: this.buildMeta(range),
      summary: {
        totalOrders,
        paidOrders,
        unpaidOrders: totalOrders - paidOrders,
        cancelledOrders,
        revenue,
        averageOrderValue,
        cancellationRate: this.resolveRate(cancelledOrders, totalOrders),
      },
      rates: {
        paidOrderRate: this.resolveRate(paidOrders, totalOrders),
        cancellationRate: this.resolveRate(cancelledOrders, totalOrders),
      },
      cards: [
        this.card('totalOrders', 'Tổng đơn hàng', totalOrders),
        this.card('paidOrders', 'Đã thanh toán', paidOrders),
        this.card('cancelledOrders', 'Đã hủy/từ chối', cancelledOrders),
        this.card('revenue', 'Doanh thu', revenue),
        this.card('averageOrderValue', 'Giá trị TB/đơn', averageOrderValue),
      ],
      series: {
        orders: this.orderSeriesFromRows(orderRows),
        revenue: this.revenueSeriesFromRows(revenueRows),
      },
      breakdowns: {
        status: statusRows.map((row) => ({
          key: row.status,
          label: this.labelOrderStatus(row.status),
          value: row._count.status,
        })),
        paymentStatus: paymentRows.map((row) => ({
          key: row.paymentStatus,
          label: this.labelPaymentStatus(row.paymentStatus),
          value: row._count.paymentStatus,
        })),
        fulfillmentStatus: fulfillmentRows.map((row) => ({
          key: row.fulfillmentStatus,
          label: this.labelFulfillmentStatus(row.fulfillmentStatus),
          value: row._count.fulfillmentStatus,
        })),
      },
    };
  }

  private async getQuoteRequestsFromRange(range: ResolvedRange) {
    const where = { createdAt: { gte: range.from, lte: range.to } };
    const [totalQuoteRequests, pendingQuoteRequests, statusRows, quoteRows] =
      await Promise.all([
        this.prisma.quoteRequest.count({ where }),
        this.prisma.quoteRequest.count({
          where: { ...where, status: QuoteRequestStatus.PENDING },
        }),
        this.prisma.quoteRequest.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
          orderBy: { status: 'asc' },
        }),
        this.countByDate('quote_requests', 'created_at', range),
      ]);

    const quotedCount =
      statusRows.find((row) => row.status === QuoteRequestStatus.QUOTED)?._count
        .status ?? 0;
    const closedCount =
      statusRows.find((row) => row.status === QuoteRequestStatus.CLOSED)?._count
        .status ?? 0;

    return {
      meta: this.buildMeta(range),
      summary: {
        totalQuoteRequests,
        pendingQuoteRequests,
        quotedQuoteRequests: quotedCount,
        closedQuoteRequests: closedCount,
        quoteCompletionRate: this.resolveRate(closedCount, totalQuoteRequests),
      },
      rates: {
        quoteCompletionRate: this.resolveRate(closedCount, totalQuoteRequests),
      },
      cards: [
        this.card('totalQuoteRequests', 'Tổng yêu cầu', totalQuoteRequests),
        this.card('pendingQuoteRequests', 'Đang chờ', pendingQuoteRequests),
        this.card('quotedQuoteRequests', 'Đã báo giá', quotedCount),
        this.card('closedQuoteRequests', 'Đã đóng', closedCount),
      ],
      series: {
        quoteRequests: this.seriesFromRows(
          'quoteRequests',
          'Yêu cầu báo giá',
          quoteRows,
        ),
      },
      breakdowns: {
        status: statusRows.map((row) => ({
          key: row.status,
          label: this.labelQuoteStatus(row.status),
          value: row._count.status,
        })),
      },
    };
  }

  private async getDashboardComparison(
    currentRange: ResolvedRange,
    previousRange: ResolvedRange,
  ) {
    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getComparisonMetrics(currentRange),
      this.getComparisonMetrics(previousRange),
    ]);

    return {
      previousFrom: previousRange.from.toISOString(),
      previousTo: previousRange.to.toISOString(),
      metrics: {
        revenue: this.comparisonMetric(
          currentMetrics.revenue,
          previousMetrics.revenue,
        ),
        orders: this.comparisonMetric(
          currentMetrics.orders,
          previousMetrics.orders,
        ),
        paidOrders: this.comparisonMetric(
          currentMetrics.paidOrders,
          previousMetrics.paidOrders,
        ),
        newUsers: this.comparisonMetric(
          currentMetrics.newUsers,
          previousMetrics.newUsers,
        ),
        quoteRequests: this.comparisonMetric(
          currentMetrics.quoteRequests,
          previousMetrics.quoteRequests,
        ),
      },
    };
  }

  private async getComparisonMetrics(range: ResolvedRange) {
    const where = { createdAt: { gte: range.from, lte: range.to } };
    const [orders, paidOrders, revenueAggregate, newUsers, quoteRequests] =
      await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.count({
          where: { ...where, paymentStatus: PaymentStatus.PAID },
        }),
        this.prisma.order.aggregate({
          where: { ...where, paymentStatus: PaymentStatus.PAID },
          _sum: { grandTotalAmount: true },
        }),
        this.prisma.user.count({ where }),
        this.prisma.quoteRequest.count({ where }),
      ]);

    return {
      revenue: this.decimalToString(revenueAggregate._sum.grandTotalAmount),
      orders,
      paidOrders,
      newUsers,
      quoteRequests,
    };
  }

  private buildDashboardAlerts(data: {
    pendingQuoteRequests: number;
    outOfStockVariants: number;
    unpaidOrders: number;
    cancelledOrders: number;
    draftProducts: number;
    trackingAvailable: boolean;
  }) {
    return [
      this.alert(
        'pendingQuoteRequests',
        'Yêu cầu báo giá đang chờ',
        data.pendingQuoteRequests,
        data.pendingQuoteRequests > 0 ? 'warning' : 'info',
        '/admin/quote-requests?status=PENDING',
      ),
      this.alert(
        'outOfStockVariants',
        'Biến thể hết hàng',
        data.outOfStockVariants,
        data.outOfStockVariants > 0 ? 'critical' : 'info',
        '/backoffice/variants?stock=out-of-stock',
      ),
      this.alert(
        'unpaidOrders',
        'Đơn chưa thanh toán',
        data.unpaidOrders,
        data.unpaidOrders > 0 ? 'warning' : 'info',
        '/backoffice/orders?paymentStatus=WAITING_CUSTOMER_TRANSFER',
      ),
      this.alert(
        'cancelledOrders',
        'Đơn bị hủy/từ chối',
        data.cancelledOrders,
        data.cancelledOrders > 0 ? 'warning' : 'info',
        '/backoffice/orders?status=CANCELLED',
      ),
      this.alert(
        'draftProducts',
        'Sản phẩm nháp',
        data.draftProducts,
        data.draftProducts > 0 ? 'warning' : 'info',
        '/backoffice/products?status=DRAFT',
      ),
      this.alert(
        'websiteTracking',
        'Tracking website chưa bật',
        data.trackingAvailable ? 0 : 1,
        data.trackingAvailable ? 'info' : 'warning',
      ),
    ];
  }

  private async countByDate(
    tableName: string,
    dateColumn: string,
    range: ResolvedRange,
  ) {
    return this.prisma.$queryRaw<DateBucketRow[]>(
      Prisma.sql`
        SELECT date_trunc(${range.interval}, ${Prisma.raw(dateColumn)}) AS bucket,
               COUNT(*)::bigint AS count
        FROM ${Prisma.raw(tableName)}
        WHERE ${Prisma.raw(dateColumn)} >= ${range.from}
          AND ${Prisma.raw(dateColumn)} <= ${range.to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
  }

  private async sumByDate(
    tableName: string,
    dateColumn: string,
    sumColumn: string,
    range: ResolvedRange,
    extraWhere?: Prisma.Sql,
  ) {
    const where = extraWhere ? Prisma.sql`AND ${extraWhere}` : Prisma.empty;

    return this.prisma.$queryRaw<DateBucketRow[]>(
      Prisma.sql`
        SELECT date_trunc(${range.interval}, ${Prisma.raw(dateColumn)}) AS bucket,
               COALESCE(SUM(${Prisma.raw(sumColumn)}), 0) AS total
        FROM ${Prisma.raw(tableName)}
        WHERE ${Prisma.raw(dateColumn)} >= ${range.from}
          AND ${Prisma.raw(dateColumn)} <= ${range.to}
          ${where}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
  }

  private async getOrderSeriesRows(range: ResolvedRange) {
    return this.prisma.$queryRaw<OrderSeriesRow[]>(
      Prisma.sql`
        SELECT date_trunc(${range.interval}, created_at) AS bucket,
               COUNT(*)::bigint AS "totalOrders",
               COUNT(*) FILTER (WHERE payment_status::text = ${PaymentStatus.PAID})::bigint AS "paidOrders",
               COUNT(*) FILTER (
                 WHERE status::text IN (${OrderStatus.CANCELLED}, ${OrderStatus.REJECTED})
               )::bigint AS "cancelledOrders"
        FROM orders
        WHERE created_at >= ${range.from}
          AND created_at <= ${range.to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
  }

  private async getRevenueSeriesRows(range: ResolvedRange) {
    return this.prisma.$queryRaw<RevenueSeriesRow[]>(
      Prisma.sql`
        SELECT date_trunc(${range.interval}, created_at) AS bucket,
               COALESCE(SUM(grand_total_amount), 0) AS revenue,
               COUNT(*)::bigint AS "orderCount"
        FROM orders
        WHERE created_at >= ${range.from}
          AND created_at <= ${range.to}
          AND payment_status::text = ${PaymentStatus.PAID}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
  }

  private findTopViewedVariants(limit: number) {
    return this.prisma.$queryRaw<TopVariantRow[]>(
      Prisma.sql`
        SELECT pv.id,
               pv.name,
               pv.slug,
               pv.sku,
               pv.product_id AS "productId",
               p.name AS "productName",
               COALESCE(pv.image_urls[1], p.image_urls[1]) AS "imageUrl",
               pv.stock_quantity AS "stockQuantity",
               pv.active AS "isActive",
               pv.pricing_status AS "pricingStatus",
               CASE
                 WHEN pv.pricing_status::text = 'CONTACT_FOR_PRICE' THEN NULL
                 ELSE COALESCE(pv.sale_price, pv.price)
               END AS price,
               pv.view_count AS metric
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        WHERE pv.active = true
        ORDER BY pv.view_count DESC, pv.created_at DESC
        LIMIT ${limit}
      `,
    );
  }

  private findTopPurchasedVariants(range: ResolvedRange) {
    return this.prisma.$queryRaw<TopVariantRow[]>(
      Prisma.sql`
        SELECT pv.id,
               pv.name,
               pv.slug,
               pv.sku,
               pv.product_id AS "productId",
               p.name AS "productName",
               COALESCE(pv.image_urls[1], p.image_urls[1]) AS "imageUrl",
               pv.stock_quantity AS "stockQuantity",
               pv.active AS "isActive",
               pv.pricing_status AS "pricingStatus",
               CASE
                 WHEN pv.pricing_status::text = 'CONTACT_FOR_PRICE' THEN NULL
                 ELSE COALESCE(pv.sale_price, pv.price)
               END AS price,
               COALESCE(SUM(oi.quantity), 0)::bigint AS metric,
               COALESCE(SUM(oi.quantity), 0)::bigint AS quantity,
               COALESCE(SUM(oi.total_amount), 0) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        INNER JOIN product_variants pv ON pv.id = oi.variant_id
        INNER JOIN products p ON p.id = oi.product_id
        WHERE o.created_at >= ${range.from}
          AND o.created_at <= ${range.to}
          AND o.payment_status::text = ${PaymentStatus.PAID}
        GROUP BY pv.id, pv.name, pv.slug, pv.sku, pv.product_id, p.name, pv.image_urls, p.image_urls, pv.stock_quantity, pv.active, pv.pricing_status, pv.sale_price, pv.price
        ORDER BY metric DESC, revenue DESC
        LIMIT ${range.topLimit}
      `,
    );
  }

  private resolveRange(query: AdminStatisticsQuery): ResolvedRange {
    const now = new Date();
    const preset = query.preset ?? '30d';
    const to = query.to ? new Date(query.to) : now;
    const from = query.from
      ? new Date(query.from)
      : this.resolvePresetFrom(preset, to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid statistics date range');
    }

    if (from > to) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }

    return {
      from,
      to,
      interval: query.interval ?? this.resolveDefaultInterval(preset, from, to),
      topLimit: query.topLimit ?? 10,
    };
  }

  private resolvePresetFrom(preset: StatisticsPreset, to: Date) {
    const from = new Date(to);
    switch (preset) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        return from;
      case '7d':
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        return from;
      case 'month':
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        return from;
      case 'year':
        from.setMonth(0, 1);
        from.setHours(0, 0, 0, 0);
        return from;
      case '30d':
      default:
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        return from;
    }
  }

  private resolveDefaultInterval(
    preset: StatisticsPreset,
    from: Date,
    to: Date,
  ): StatisticsInterval {
    if (preset === 'year') {
      return 'month';
    }

    const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
    if (days > 120) {
      return 'month';
    }
    if (days > 45) {
      return 'week';
    }

    return 'day';
  }

  private resolvePreviousRange(range: ResolvedRange): ResolvedRange {
    const duration = range.to.getTime() - range.from.getTime();
    const previousTo = new Date(range.from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - duration);

    return {
      ...range,
      from: previousFrom,
      to: previousTo,
    };
  }

  private buildMeta(range: ResolvedRange) {
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      interval: range.interval,
      topLimit: range.topLimit,
    };
  }

  private comparisonMetric(
    current: string | number,
    previous: string | number,
  ) {
    return {
      current,
      previous,
      changePercent: this.resolveChangePercent(current, previous),
    };
  }

  private resolveChangePercent(
    current: string | number,
    previous: string | number,
  ) {
    const currentValue = Number(current);
    const previousValue = Number(previous);

    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
      return 0;
    }

    if (previousValue === 0) {
      return currentValue > 0 ? 100 : 0;
    }

    return Number(
      (((currentValue - previousValue) / previousValue) * 100).toFixed(2),
    );
  }

  private card(key: string, label: string, value: string | number | null) {
    return { key, label, value };
  }

  private alert(
    key: string,
    label: string,
    value: number,
    severity: AlertSeverity,
    href?: string,
  ) {
    return { key, label, value, severity, href };
  }

  private emptySeries(key: string, label: string) {
    return { key, label, points: [] };
  }

  private seriesFromRows(key: string, label: string, rows: DateBucketRow[]) {
    return {
      key,
      label,
      points: rows.map((row) => ({
        x: row.bucket.toISOString(),
        y: this.resolveNumericValue(row.count ?? row.total ?? 0),
      })),
    };
  }

  private orderSeriesFromRows(rows: OrderSeriesRow[]) {
    return {
      key: 'orders',
      label: 'Đơn hàng',
      points: rows.map((row) => {
        const totalOrders = this.resolveNumericValue(row.totalOrders);

        return {
          x: row.bucket.toISOString(),
          y: totalOrders,
          totalOrders,
          paidOrders: this.resolveNumericValue(row.paidOrders),
          cancelledOrders: this.resolveNumericValue(row.cancelledOrders),
        };
      }),
    };
  }

  private revenueSeriesFromRows(rows: RevenueSeriesRow[]) {
    return {
      key: 'revenue',
      label: 'Doanh thu',
      points: rows.map((row) => {
        const revenue = this.decimalToString(row.revenue);

        return {
          x: row.bucket.toISOString(),
          y: this.resolveNumericValue(revenue),
          revenue,
          orderCount: this.resolveNumericValue(row.orderCount),
        };
      }),
    };
  }

  private serializeTopVariant(row: TopVariantRow, metricKey: string) {
    const stockQuantity = this.resolveNumericValue(row.stockQuantity);
    const contactForPrice = row.pricingStatus === 'CONTACT_FOR_PRICE';

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      productId: row.productId,
      productName: row.productName,
      imageUrl: row.imageUrl,
      metricKey,
      metricValue: this.resolveNumericValue(row.metric ?? 0),
      quantity:
        row.quantity === undefined || row.quantity === null
          ? undefined
          : this.resolveNumericValue(row.quantity),
      revenue:
        row.revenue === undefined
          ? undefined
          : this.decimalToString(row.revenue),
      stockQuantity,
      isActive: row.isActive,
      isInStock: stockQuantity > 0,
      contactForPrice,
      price: contactForPrice ? null : this.decimalToString(row.price),
    };
  }

  private resolveNumericValue(
    value: bigint | number | Prisma.Decimal | string,
  ) {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (value instanceof Prisma.Decimal) {
      return Number(value.toString());
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  }

  private decimalToString(
    value: Prisma.Decimal | string | number | bigint | null | undefined,
  ) {
    if (value === null || value === undefined) {
      return '0';
    }

    return value.toString();
  }

  private resolveRate(value: number, total: number) {
    if (total <= 0) {
      return 0;
    }

    return Number(((value / total) * 100).toFixed(2));
  }

  private labelRole(role: AppRole) {
    const labels: Record<AppRole, string> = {
      USER: 'Người dùng',
      STAFF: 'Nhân viên',
      ADMIN: 'Quản trị',
    };

    return labels[role];
  }

  private labelOrderStatus(status: OrderStatus) {
    const labels: Record<OrderStatus, string> = {
      PENDING_PAYMENT: 'Chờ thanh toán',
      PAYMENT_REVIEW: 'Chờ duyệt thanh toán',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang xử lý',
      READY_TO_SHIP: 'Sẵn sàng giao',
      SHIPPING: 'Đang giao',
      COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
      REJECTED: 'Từ chối',
    };

    return labels[status];
  }

  private labelPaymentStatus(status: PaymentStatus) {
    const labels: Record<PaymentStatus, string> = {
      WAITING_CUSTOMER_TRANSFER: 'Chờ khách chuyển khoản',
      CUSTOMER_CONFIRMED: 'Khách đã xác nhận',
      PAID: 'Đã thanh toán',
      REJECTED: 'Từ chối',
      REFUNDED: 'Đã hoàn tiền',
    };

    return labels[status];
  }

  private labelQuoteStatus(status: QuoteRequestStatus) {
    const labels: Record<QuoteRequestStatus, string> = {
      PENDING: 'Đang chờ',
      QUOTED: 'Đã báo giá',
      CANCELLED: 'Đã hủy',
      CLOSED: 'Đã đóng',
    };

    return labels[status];
  }

  private labelFulfillmentStatus(status: FulfillmentStatus) {
    const labels: Record<FulfillmentStatus, string> = {
      NOT_STARTED: 'Chưa bắt đầu',
      PROCESSING: 'Đang xử lý',
      READY_TO_SHIP: 'Sẵn sàng giao',
      SHIPPING: 'Đang giao',
      DELIVERED: 'Đã giao',
      FAILED: 'Giao thất bại',
      RETURNED: 'Đã hoàn trả',
    };

    return labels[status];
  }
}
