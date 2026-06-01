import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttributeDataType,
  Prisma,
  VariantPricingStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateVariantDto } from './create-variant.dto';
import { UpdateVariantDto } from './update-variant.dto';
import { CategoryService } from '../category/category.service';
import {
  ListVariantsQuery,
  ParsedAttributeFilter,
  VariantSort,
} from './list-variants.query';
import { CloudinaryService } from '../../media/cloudinary.service';
import { TaxService } from '../../tax/tax.service';
import { CountryService } from '../../../common/countries/country.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

type VariantImportError = {
  rowNumber: number;
  field: string;
  message: string;
};

type NormalizedVariantImportAttributeValue = {
  definitionId: string;
  code: string;
  valueText: string | null;
  valueNumber: Prisma.Decimal | null;
  valueBoolean: boolean | null;
  valueEnum: string | null;
};

type NormalizedVariantImportRow = {
  rowNumber: number;
  no: string;
  variantName: string;
  sku: string;
  manufacturerPartNumber: string | null;
  originCountryCode: string | null;
  slug: string;
  price: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  pricingStatus: VariantPricingStatus;
  stockQuantity: number;
  unit: string;
  attributeValues: NormalizedVariantImportAttributeValue[];
};

type VariantImportPlan = {
  productId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: VariantImportError[];
  headers: string[];
  attributeColumns: string[];
  rows: NormalizedVariantImportRow[];
};

type VariantImportBaseColumn = {
  key:
    | 'no'
    | 'variantName'
    | 'sku'
    | 'manufacturerPartNumber'
    | 'price'
    | 'costPrice'
    | 'stockQuantity'
    | 'unit'
    | 'originCountry';
  label: string;
  aliases: readonly string[];
};

@Injectable()
export class VariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly taxService: TaxService,
    private readonly countryService: CountryService,
  ) {}

  findAllBackoffice() {
    return this.prisma.productVariant
      .findMany({
        orderBy: [{ createdAt: 'desc' }],
        include: {
          category: true,
          brand: true,
          product: true,
          _count: {
            select: {
              attributeValues: true,
            },
          },
        },
      })
      .then((variants) =>
        variants.map((variant) => ({
          ...variant,
          effectiveImageUrls:
            variant.imageUrls.length > 0
              ? variant.imageUrls
              : variant.product.imageUrls,
        })),
      );
  }

  findOne(id: string) {
    return this.prisma.productVariant
      .findUnique({
        where: { id },
        include: {
          category: true,
          brand: true,
          product: true,
          attributeValues: {
            include: {
              productAttributeDefinition: true,
            },
            orderBy: {
              productAttributeDefinition: {
                sortOrder: 'asc',
              },
            },
          },
        },
      })
      .then((variant) => {
        if (!variant) {
          return null;
        }

        return {
          ...variant,
          effectiveImageUrls:
            variant.imageUrls.length > 0
              ? variant.imageUrls
              : variant.product.imageUrls,
        };
      });
  }

  async create(data: CreateVariantDto) {
    const product = await this.ensureProductExists(data.productId);
    const originCountryCode = this.resolveOriginCountryCode(
      data.originCountryCode,
    );

    const createData: Prisma.ProductVariantUncheckedCreateInput = {
      productId: product.id,
      categoryId: product.categoryId,
      brandId: product.brandId,
      sku: data.sku,
      manufacturerPartNumber: data.manufacturerPartNumber,
      originCountryCode,
      name: data.name,
      slug: data.slug,
      price: new Prisma.Decimal(data.price),
      costPrice: new Prisma.Decimal(data.costPrice ?? data.price),
      ...(data.salePrice !== undefined
        ? { salePrice: new Prisma.Decimal(data.salePrice) }
        : {}),
      ...(data.discountPercent !== undefined
        ? { discountPercent: new Prisma.Decimal(data.discountPercent) }
        : {}),
      pricingStatus: data.pricingStatus ?? 'HAS_PRICE',
      ...(data.taxPercent !== undefined
        ? { taxPercent: new Prisma.Decimal(data.taxPercent) }
        : {}),
      stockQuantity: data.stockQuantity ?? 0,
      unit: data.unit,
      minOrderQuantity: data.minOrderQuantity ?? 1,
      score: new Prisma.Decimal(data.score ?? 0),
      viewCount: data.viewCount ?? 0,
      orderCount: data.orderCount ?? 0,
      imageUrls: data.imageUrls ?? [],
      imagePublicIds: [],
      active: data.active ?? true,
    };

    if (data.specSnapshot !== undefined) {
      createData.specSnapshot = data.specSnapshot as Prisma.InputJsonValue;
    }

    return this.prisma.productVariant.create({
      data: createData,
      include: {
        category: true,
        brand: true,
        product: true,
      },
    });
  }

  async findAll(query: ListVariantsQuery) {
    const where = await this.buildPublicWhere(query);
    const take = this.resolveTake(query.limit);

    const variants = await this.prisma.productVariant.findMany({
      where,
      include: {
        category: true,
        brand: true,
        product: true,
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take,
    });

    return Promise.all(
      variants.map((variant) => this.withPublicPricing(variant)),
    );
  }

  async search(query: ListVariantsQuery) {
    const where = await this.buildPublicWhere(query);
    const pagination = this.resolvePagination(query.page, query.limit);
    const orderBy = this.resolveSearchOrderBy(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        include: {
          category: true,
          brand: true,
          product: true,
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      items: await Promise.all(
        items.map((variant) => this.withPublicPricing(variant)),
      ),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }

  async findBySlug(slug: string) {
    const detailInclude = {
      category: true,
      brand: true,
      product: true,
      attributeValues: {
        include: {
          productAttributeDefinition: true,
        },
        orderBy: {
          productAttributeDefinition: {
            sortOrder: 'asc',
          },
        },
      },
    } satisfies Prisma.ProductVariantInclude;

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        slug,
        active: true,
        product: {
          active: true,
          status: 'PUBLISHED',
        },
      },
      include: detailInclude,
    });

    if (!variant) {
      return null;
    }

    const viewedVariant = await this.prisma.productVariant.update({
      where: { id: variant.id },
      data: {
        viewCount: { increment: 1 },
      },
      include: detailInclude,
    });

    return this.withPublicPricing(viewedVariant);
  }

  async update(id: string, data: UpdateVariantDto) {
    await this.ensureVariantExists(id);

    let productMeta:
      | {
          id: string;
          categoryId: string;
          brandId: string | null;
        }
      | undefined;
    if (data.productId) {
      productMeta = await this.ensureProductExists(data.productId);
    }
    const originCountryCode =
      data.originCountryCode !== undefined
        ? this.resolveOriginCountryCode(data.originCountryCode)
        : undefined;

    const updateData: Prisma.ProductVariantUncheckedUpdateInput = {
      ...(data.productId !== undefined ? { productId: data.productId } : {}),
      ...(productMeta
        ? { categoryId: productMeta.categoryId, brandId: productMeta.brandId }
        : {}),
      ...(data.sku !== undefined ? { sku: data.sku } : {}),
      ...(data.manufacturerPartNumber !== undefined
        ? { manufacturerPartNumber: data.manufacturerPartNumber }
        : {}),
      ...(data.originCountryCode !== undefined ? { originCountryCode } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.price !== undefined
        ? { price: new Prisma.Decimal(data.price) }
        : {}),
      ...(data.costPrice !== undefined
        ? { costPrice: new Prisma.Decimal(data.costPrice) }
        : {}),
      ...(data.salePrice !== undefined
        ? { salePrice: new Prisma.Decimal(data.salePrice) }
        : {}),
      ...(data.discountPercent !== undefined
        ? { discountPercent: new Prisma.Decimal(data.discountPercent) }
        : {}),
      ...(data.pricingStatus !== undefined
        ? { pricingStatus: data.pricingStatus }
        : {}),
      ...(data.taxPercent !== undefined
        ? { taxPercent: new Prisma.Decimal(data.taxPercent) }
        : {}),
      ...(data.stockQuantity !== undefined
        ? { stockQuantity: data.stockQuantity }
        : {}),
      ...(data.unit !== undefined ? { unit: data.unit } : {}),
      ...(data.minOrderQuantity !== undefined
        ? { minOrderQuantity: data.minOrderQuantity }
        : {}),
      ...(data.score !== undefined
        ? { score: new Prisma.Decimal(data.score) }
        : {}),
      ...(data.viewCount !== undefined ? { viewCount: data.viewCount } : {}),
      ...(data.orderCount !== undefined ? { orderCount: data.orderCount } : {}),
      ...(data.imageUrls !== undefined ? { imageUrls: data.imageUrls } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    };

    if (data.specSnapshot !== undefined) {
      updateData.specSnapshot = data.specSnapshot as Prisma.InputJsonValue;
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        brand: true,
        product: true,
      },
    });
  }

  async recordRating(id: string, ratingValue: number) {
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id },
        select: {
          id: true,
          ratingCount: true,
          ratingTotal: true,
        },
      });

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }

      const nextTotal = variant.ratingTotal.plus(
        new Prisma.Decimal(ratingValue),
      );
      const nextCount = variant.ratingCount + 1;
      const nextAverage = new Prisma.Decimal(5)
        .plus(nextTotal)
        .div(nextCount + 1)
        .toDecimalPlaces(2);

      return tx.productVariant.update({
        where: { id },
        data: {
          ratingTotal: nextTotal,
          ratingCount: nextCount,
          ratingAverage: nextAverage,
        },
        include: {
          category: true,
          brand: true,
          product: true,
        },
      });
    });
  }

  async remove(id: string) {
    await this.ensureVariantExists(id);

    return this.prisma.productVariant.update({
      where: { id },
      data: { active: false },
    });
  }

  async uploadImage(id: string, file: UploadedImageFile) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        imageUrls: true,
        imagePublicIds: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const uploaded = await this.cloudinaryService.uploadBuffer({
      buffer: file.buffer,
      folder: 'variants',
      publicId: `${variant.slug}-${Date.now()}`,
    });

    return this.prisma.productVariant.update({
      where: { id },
      data: {
        imageUrls: [...variant.imageUrls, uploaded.secureUrl],
        imagePublicIds: [...variant.imagePublicIds, uploaded.publicId],
      },
      include: {
        category: true,
        brand: true,
        product: true,
      },
    });
  }

  async removeImage(id: string, publicId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrls: true,
        imagePublicIds: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const index = variant.imagePublicIds.findIndex(
      (value) => value === publicId,
    );
    if (index === -1) {
      throw new NotFoundException('Image not found');
    }

    await this.cloudinaryService.destroy(publicId);

    const nextUrls = variant.imageUrls.filter((_, idx) => idx !== index);
    const nextPublicIds = variant.imagePublicIds.filter(
      (_, idx) => idx !== index,
    );

    return this.prisma.productVariant.update({
      where: { id },
      data: {
        imageUrls: nextUrls,
        imagePublicIds: nextPublicIds,
      },
      include: {
        category: true,
        brand: true,
        product: true,
      },
    });
  }

  async buildVariantImportTemplate(productId: string) {
    await this.ensureProductExists(productId);

    const definitions = await this.prisma.productAttributeDefinition.findMany({
      where: {
        productId,
        active: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        name: true,
      },
    });

    const headers = [
      ...this.getVariantImportBaseHeaders(),
      ...definitions.map((definition) =>
        this.normalizeHeaderText(definition.name),
      ),
    ];

    return `${headers.map((header) => this.escapeCsvCell(header)).join(',')}\n`;
  }

  async previewVariantImport(productId: string, fileBuffer: Buffer) {
    const plan = await this.buildVariantImportPlan(productId, fileBuffer);

    return {
      productId,
      headers: plan.headers,
      attributeColumns: plan.attributeColumns,
      totalRows: plan.totalRows,
      validRows: plan.validRows,
      invalidRows: plan.invalidRows,
      errors: plan.errors,
      rows: plan.rows.map((row) => ({
        rowNumber: row.rowNumber,
        no: row.no,
        variantName: row.variantName,
        sku: row.sku,
        originCountryCode: row.originCountryCode,
        originCountryName:
          this.countryService.resolve(row.originCountryCode)?.nameVi ?? null,
        slug: row.slug,
        price: row.price.toString(),
        costPrice: row.costPrice.toString(),
        pricingStatus: row.pricingStatus,
        stockQuantity: row.stockQuantity,
        unit: row.unit,
      })),
    };
  }

  async commitVariantImport(productId: string, fileBuffer: Buffer) {
    const plan = await this.buildVariantImportPlan(productId, fileBuffer);

    if (plan.errors.length > 0) {
      throw new BadRequestException({
        message: 'CSV validation failed',
        totalRows: plan.totalRows,
        validRows: plan.validRows,
        invalidRows: plan.invalidRows,
        errors: plan.errors,
      });
    }

    const product = await this.ensureProductExists(productId);

    const createdVariants = await this.prisma.$transaction(async (tx) => {
      const results: Array<{
        id: string;
        name: string;
        sku: string;
        slug: string;
        pricingStatus: VariantPricingStatus;
        originCountryCode: string | null;
      }> = [];

      for (const row of plan.rows) {
        const snapshot = this.buildSpecSnapshotFromAttributeValues(
          row.attributeValues,
        );

        const created = await tx.productVariant.create({
          data: {
            productId: product.id,
            categoryId: product.categoryId,
            brandId: product.brandId,
            sku: row.sku,
            manufacturerPartNumber: row.manufacturerPartNumber,
            originCountryCode: row.originCountryCode,
            name: row.variantName,
            slug: row.slug,
            price: row.price,
            costPrice: row.costPrice,
            pricingStatus: row.pricingStatus,
            stockQuantity: row.stockQuantity,
            unit: row.unit,
            minOrderQuantity: 1,
            score: new Prisma.Decimal(0),
            viewCount: 0,
            orderCount: 0,
            specSnapshot:
              Object.keys(snapshot).length > 0
                ? (snapshot as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            imageUrls: [],
            imagePublicIds: [],
            active: true,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            slug: true,
            pricingStatus: true,
            originCountryCode: true,
          },
        });

        if (row.attributeValues.length > 0) {
          await tx.variantAttributeValue.createMany({
            data: row.attributeValues.map((value) => ({
              variantId: created.id,
              productAttributeDefinitionId: value.definitionId,
              valueText: value.valueText,
              valueNumber: value.valueNumber,
              valueBoolean: value.valueBoolean,
              valueEnum: value.valueEnum,
            })),
          });
        }

        results.push(created);
      }

      return results;
    });

    return {
      productId,
      totalRows: plan.totalRows,
      createdCount: createdVariants.length,
      createdVariants,
    };
  }

  private async buildVariantImportPlan(
    productId: string,
    fileBuffer: Buffer,
  ): Promise<VariantImportPlan> {
    await this.ensureProductExists(productId);

    const definitions = await this.prisma.productAttributeDefinition.findMany({
      where: {
        productId,
        active: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        dataType: true,
        isRequired: true,
      },
    });

    const parsed = this.parseCsvContent(fileBuffer);
    const allBaseColumns = this.getVariantImportBaseColumns();
    const originCountryColumn = allBaseColumns.find(
      (column) => column.key === 'originCountry',
    )!;
    const requiredBaseColumns = allBaseColumns.filter(
      (column) => column.key !== 'originCountry',
    );
    const hasOriginCountryColumn = this.isHeaderMatch(
      parsed.headers[requiredBaseColumns.length] ?? '',
      originCountryColumn.aliases,
    );
    const baseColumns = hasOriginCountryColumn
      ? allBaseColumns
      : requiredBaseColumns;
    const expectedAttributeColumns = definitions.map(
      (definition) => definition.name,
    );
    const expectedHeaders = [
      ...baseColumns.map((column) => column.label),
      ...expectedAttributeColumns,
    ];

    if (parsed.headers.length !== expectedHeaders.length) {
      throw new BadRequestException(
        `CSV column count mismatch. Expected ${expectedHeaders.length} column(s) but got ${parsed.headers.length}`,
      );
    }

    for (let index = 0; index < baseColumns.length; index += 1) {
      const header = parsed.headers[index] ?? '';
      const column = baseColumns[index];

      if (!this.isHeaderMatch(header, column.aliases)) {
        throw new BadRequestException(
          `Invalid CSV column at position ${index + 1}. Expected "${column.label}"`,
        );
      }
    }

    for (let index = 0; index < definitions.length; index += 1) {
      const expectedName = definitions[index].name;
      const columnIndex = baseColumns.length + index;
      const header = parsed.headers[columnIndex] ?? '';

      if (
        this.normalizeHeaderText(header) !==
        this.normalizeHeaderText(expectedName)
      ) {
        throw new BadRequestException(
          `Invalid attribute column at position ${columnIndex + 1}. Expected "${expectedName}"`,
        );
      }
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException('CSV has no data rows');
    }

    const rawSkus = parsed.rows
      .map((row) => this.getCsvCell(row.cells, 2))
      .filter((value) => value.length > 0);
    const uniqueSkus = [...new Set(rawSkus)];
    const existingSkuSet = new Set(
      (
        await this.prisma.productVariant.findMany({
          where: {
            sku: {
              in: uniqueSkus.length > 0 ? uniqueSkus : ['__never_match__'],
            },
          },
          select: {
            sku: true,
          },
        })
      ).map((item) => item.sku),
    );
    const fileSkuCount = new Map<string, number>();
    for (const sku of rawSkus) {
      fileSkuCount.set(sku, (fileSkuCount.get(sku) ?? 0) + 1);
    }

    const errors: VariantImportError[] = [];
    const validRows: NormalizedVariantImportRow[] = [];
    const reservedSlugs = new Set<string>();

    for (const row of parsed.rows) {
      const rowErrors: VariantImportError[] = [];
      const no = this.getCsvCell(row.cells, 0) || String(row.rowNumber - 1);
      const variantName = this.getCsvCell(row.cells, 1);
      const sku = this.getCsvCell(row.cells, 2);
      const manufacturerPartNumberRaw = this.getCsvCell(row.cells, 3);
      const priceRaw = this.getCsvCell(row.cells, 4);
      const costPriceRaw = this.getCsvCell(row.cells, 5);
      const stockQuantityRaw = this.getCsvCell(row.cells, 6);
      const unit = this.getCsvCell(row.cells, 7);
      const originCountryRaw = hasOriginCountryColumn
        ? this.getCsvCell(row.cells, 8)
        : '';

      if (!variantName) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          field: parsed.headers[1] ?? 'Tên biến thể',
          message: 'Tên biến thể là bắt buộc',
        });
      }

      if (!sku) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          field: parsed.headers[2] ?? 'SKU',
          message: 'SKU là bắt buộc',
        });
      } else {
        if ((fileSkuCount.get(sku) ?? 0) > 1) {
          rowErrors.push({
            rowNumber: row.rowNumber,
            field: parsed.headers[2] ?? 'SKU',
            message: 'SKU bị trùng trong file CSV',
          });
        }
        if (existingSkuSet.has(sku)) {
          rowErrors.push({
            rowNumber: row.rowNumber,
            field: parsed.headers[2] ?? 'SKU',
            message: 'SKU đã tồn tại trong hệ thống',
          });
        }
      }

      const price = this.parseImportPriceCell(
        priceRaw,
        row.rowNumber,
        parsed.headers[4] ?? 'Giá bán',
        rowErrors,
      );
      const costPrice = this.parseDecimalCell(
        costPriceRaw || priceRaw || '0',
        row.rowNumber,
        parsed.headers[5] ?? 'Giá nhập',
        rowErrors,
      );
      const pricingStatus =
        !price || price.isZero()
          ? VariantPricingStatus.CONTACT_FOR_PRICE
          : VariantPricingStatus.HAS_PRICE;
      const stockQuantity = this.parseIntegerCell(
        stockQuantityRaw,
        row.rowNumber,
        parsed.headers[6] ?? 'Tồn kho',
        rowErrors,
      );

      if (!unit) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          field: parsed.headers[7] ?? 'Đơn vị',
          message: 'Đơn vị là bắt buộc',
        });
      }

      const originCountry = this.resolveImportOriginCountry(
        originCountryRaw,
        row.rowNumber,
        parsed.headers[8] ?? 'Xuất xứ',
        rowErrors,
      );

      const normalizedAttributeValues: NormalizedVariantImportAttributeValue[] =
        [];
      const baseColumnCount = baseColumns.length;

      for (let index = 0; index < definitions.length; index += 1) {
        const definition = definitions[index];
        const columnIndex = baseColumnCount + index;
        const column = parsed.headers[columnIndex] ?? definition.name;
        const rawValue = this.getCsvCell(row.cells, columnIndex);

        if (!rawValue) {
          if (definition.isRequired) {
            rowErrors.push({
              rowNumber: row.rowNumber,
              field: column,
              message: `${definition.name} là bắt buộc`,
            });
          }
          continue;
        }

        const parsedValue = this.parseAttributeCell(
          definition.dataType,
          rawValue,
          row.rowNumber,
          column,
          rowErrors,
        );

        if (parsedValue) {
          normalizedAttributeValues.push({
            definitionId: definition.id,
            code: definition.code,
            valueText: parsedValue.valueText,
            valueNumber: parsedValue.valueNumber,
            valueBoolean: parsedValue.valueBoolean,
            valueEnum: parsedValue.valueEnum,
          });
        }
      }

      let slug = '';
      if (variantName) {
        slug = await this.resolveUniqueVariantSlug(
          this.buildSlug(variantName),
          reservedSlugs,
        );
      } else {
        rowErrors.push({
          rowNumber: row.rowNumber,
          field: parsed.headers[1] ?? 'Tên biến thể',
          message: 'Không thể tạo slug vì thiếu tên biến thể',
        });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      validRows.push({
        rowNumber: row.rowNumber,
        no,
        variantName,
        sku,
        manufacturerPartNumber: manufacturerPartNumberRaw || null,
        originCountryCode: originCountry?.code ?? null,
        slug,
        price: price ?? new Prisma.Decimal(0),
        costPrice: costPrice!,
        pricingStatus,
        stockQuantity: stockQuantity!,
        unit,
        attributeValues: normalizedAttributeValues,
      });
    }

    return {
      productId,
      totalRows: parsed.rows.length,
      validRows: validRows.length,
      invalidRows: parsed.rows.length - validRows.length,
      errors,
      headers: parsed.headers,
      attributeColumns: expectedAttributeColumns,
      rows: validRows,
    };
  }

  private async withPublicPricing<
    TVariant extends Prisma.ProductVariantGetPayload<{
      include: { product: true };
    }>,
  >(variant: TVariant) {
    const effectivePrice = this.resolveEffectivePrice(variant);
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
      rating: this.serializeRating(variant),
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
        effectivePrice: effectivePrice.toString(),
        taxAmount: taxAmount.toString(),
        totalWithTax: effectivePrice.plus(taxAmount).toString(),
      },
    };
  }

  private serializeRating(
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

  private parseCsvContent(fileBuffer: Buffer) {
    const text = fileBuffer.toString('utf8').replace(/^\uFEFF/, '');
    const matrix = this.parseCsvMatrix(text);
    const rows = matrix.filter((row) => row.some((cell) => cell.trim() !== ''));

    if (rows.length === 0) {
      throw new BadRequestException('CSV is empty');
    }

    const headers = rows[0].map((value) => value.trim());
    if (headers.some((header) => header.length === 0)) {
      throw new BadRequestException('CSV contains empty header column');
    }

    return {
      headers,
      rows: rows.slice(1).map((values, index) => {
        return {
          rowNumber: index + 2,
          cells: headers.map((_, headerIndex) => values[headerIndex] ?? ''),
        };
      }),
    };
  }

  private escapeCsvCell(value: string) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private parseCsvMatrix(content: string) {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentCell += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          currentCell += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }

      if (char === '\r') {
        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];

        if (nextChar === '\n') {
          i += 1;
        }
        continue;
      }

      if (char === '\n') {
        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        continue;
      }

      currentCell += char;
    }

    currentRow.push(currentCell);
    rows.push(currentRow);

    return rows;
  }

  private parseDecimalCell(
    rawValue: string,
    rowNumber: number,
    field: string,
    rowErrors: VariantImportError[],
  ) {
    if (!rawValue) {
      rowErrors.push({
        rowNumber,
        field,
        message: `${field} is required`,
      });
      return null;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      rowErrors.push({
        rowNumber,
        field,
        message: `${field} must be a valid number`,
      });
      return null;
    }

    if (parsed < 0) {
      rowErrors.push({
        rowNumber,
        field,
        message: `${field} must be greater than or equal to 0`,
      });
      return null;
    }

    return new Prisma.Decimal(parsed);
  }

  private parseImportPriceCell(
    rawValue: string,
    rowNumber: number,
    field: string,
    rowErrors: VariantImportError[],
  ) {
    if (!rawValue) {
      return null;
    }

    return this.parseDecimalCell(rawValue, rowNumber, field, rowErrors);
  }

  private resolveImportOriginCountry(
    rawValue: string,
    rowNumber: number,
    field: string,
    rowErrors: VariantImportError[],
  ) {
    if (!rawValue) {
      return null;
    }

    const country = this.countryService.resolve(rawValue);
    if (!country) {
      rowErrors.push({
        rowNumber,
        field,
        message:
          'Xuất xứ không hợp lệ. Vui lòng dùng mã ISO như CN, VN, TH hoặc tên quốc gia hợp lệ.',
      });
      return null;
    }

    return country;
  }

  private parseIntegerCell(
    rawValue: string,
    rowNumber: number,
    field: string,
    rowErrors: VariantImportError[],
  ) {
    if (!rawValue) {
      rowErrors.push({
        rowNumber,
        field,
        message: `${field} is required`,
      });
      return null;
    }

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed)) {
      rowErrors.push({
        rowNumber,
        field,
        message: `${field} must be an integer`,
      });
      return null;
    }

    if (parsed < 0) {
      rowErrors.push({
        rowNumber,
        field,
        message: `${field} must be greater than or equal to 0`,
      });
      return null;
    }

    return parsed;
  }

  private parseAttributeCell(
    dataType: AttributeDataType,
    rawValue: string,
    rowNumber: number,
    field: string,
    rowErrors: VariantImportError[],
  ) {
    switch (dataType) {
      case AttributeDataType.TEXT:
        return {
          valueText: rawValue,
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
        };
      case AttributeDataType.NUMBER: {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) {
          rowErrors.push({
            rowNumber,
            field,
            message: `${field} must be a valid number`,
          });
          return null;
        }

        return {
          valueText: null,
          valueNumber: new Prisma.Decimal(parsed),
          valueBoolean: null,
          valueEnum: null,
        };
      }
      case AttributeDataType.BOOLEAN: {
        const normalized = rawValue.toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) {
          return {
            valueText: null,
            valueNumber: null,
            valueBoolean: true,
            valueEnum: null,
          };
        }
        if (['false', '0', 'no', 'n'].includes(normalized)) {
          return {
            valueText: null,
            valueNumber: null,
            valueBoolean: false,
            valueEnum: null,
          };
        }

        rowErrors.push({
          rowNumber,
          field,
          message: `${field} must be boolean (true/false, 1/0, yes/no)`,
        });
        return null;
      }
      case AttributeDataType.ENUM:
        return {
          valueText: null,
          valueNumber: null,
          valueBoolean: null,
          valueEnum: rawValue,
        };
      default:
        rowErrors.push({
          rowNumber,
          field,
          message: `${field} has unsupported data type`,
        });
        return null;
    }
  }

  private buildSpecSnapshotFromAttributeValues(
    values: NormalizedVariantImportAttributeValue[],
  ) {
    const snapshot: Record<string, string | number | boolean> = {};
    for (const value of values) {
      if (value.valueText !== null) {
        snapshot[value.code] = value.valueText;
      } else if (value.valueNumber !== null) {
        snapshot[value.code] = Number(value.valueNumber);
      } else if (value.valueBoolean !== null) {
        snapshot[value.code] = value.valueBoolean;
      } else if (value.valueEnum !== null) {
        snapshot[value.code] = value.valueEnum;
      }
    }

    return snapshot;
  }

  private async resolveUniqueVariantSlug(
    baseSlug: string,
    usedSlugs: Set<string>,
  ) {
    const normalizedBase = baseSlug || 'variant';
    let candidate = normalizedBase;
    let suffix = 1;

    while (
      usedSlugs.has(candidate) ||
      (await this.prisma.productVariant.findFirst({
        where: { slug: candidate },
        select: { id: true },
      }))
    ) {
      suffix += 1;
      candidate = `${normalizedBase}-${suffix}`;
    }

    usedSlugs.add(candidate);
    return candidate;
  }

  private buildSlug(text: string) {
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'variant';
  }
  private normalizeHeaderText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'd')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  private isHeaderMatch(header: string, aliases: readonly string[]) {
    const normalizedHeader = this.normalizeHeaderText(header);
    return aliases.some(
      (alias) => this.normalizeHeaderText(alias) === normalizedHeader,
    );
  }

  private getCsvCell(cells: string[], index: number) {
    return (cells[index] ?? '').trim();
  }

  private resolveOriginCountryCode(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value.trim() === '') {
      return null;
    }

    const country = this.countryService.resolve(value);
    if (!country) {
      throw new BadRequestException('Origin country is invalid');
    }

    return country.code;
  }

  private getVariantImportBaseColumns(): readonly VariantImportBaseColumn[] {
    return [
      {
        key: 'no',
        label: 'no',
        aliases: ['no', 'thu tu', 'stt'],
      },
      {
        key: 'variantName',
        label: 'ten bien the',
        aliases: ['ten bien the', 'variantname'],
      },
      {
        key: 'sku',
        label: 'SKU',
        aliases: ['sku'],
      },
      {
        key: 'manufacturerPartNumber',
        label: 'ma hang san xuat',
        aliases: ['ma hang san xuat', 'manufacturerpartnumber', 'manufacture'],
      },
      {
        key: 'price',
        label: 'gia ban',
        aliases: ['gia ban', 'price'],
      },
      {
        key: 'costPrice',
        label: 'gia nhap',
        aliases: ['gia nhap', 'costprice'],
      },
      {
        key: 'stockQuantity',
        label: 'ton kho',
        aliases: ['ton kho', 'stockquantity'],
      },
      {
        key: 'unit',
        label: 'don vi',
        aliases: ['don vi', 'unit'],
      },
      {
        key: 'originCountry',
        label: 'xuat xu',
        aliases: ['xuat xu', 'origin', 'origin country', 'country'],
      },
    ] as const;
  }
  private getVariantImportBaseHeaders() {
    return this.getVariantImportBaseColumns().map((column) => column.label);
  }

  private async ensureVariantExists(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }
  }

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        brandId: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async buildPublicWhere(
    query: ListVariantsQuery,
  ): Promise<Prisma.ProductVariantWhereInput> {
    const andConditions: Prisma.ProductVariantWhereInput[] = [
      {
        active: true,
        product: {
          active: true,
          status: 'PUBLISHED',
        },
      },
    ];

    if (query.categoryId) {
      const categoryIds = await this.categoryService.getDescendantIds(
        query.categoryId,
      );
      andConditions.push({
        categoryId: {
          in: categoryIds,
        },
      });
    }

    if (query.productId) {
      andConditions.push({
        productId: query.productId,
      });
    }

    if (query.brandId) {
      andConditions.push({
        brandId: query.brandId,
      });
    }

    if (query.originCountryCode) {
      const originCountryCode = this.countryService.requireValidCode(
        query.originCountryCode,
      );
      if (!originCountryCode) {
        return { id: '__invalid_origin_country__' };
      }

      andConditions.push({
        originCountryCode,
      });
    }

    if (query.priceMin || query.priceMax) {
      andConditions.push({
        price: {
          ...(query.priceMin !== undefined
            ? { gte: new Prisma.Decimal(query.priceMin) }
            : {}),
          ...(query.priceMax !== undefined
            ? { lte: new Prisma.Decimal(query.priceMax) }
            : {}),
        },
      });
    }

    const keyword = query.q?.trim();
    if (keyword) {
      andConditions.push({
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { slug: { contains: keyword, mode: 'insensitive' } },
          { sku: { contains: keyword, mode: 'insensitive' } },
          {
            manufacturerPartNumber: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            product: {
              name: { contains: keyword, mode: 'insensitive' },
            },
          },
          {
            product: {
              slug: { contains: keyword, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    for (const filter of query.attrFilters) {
      andConditions.push(this.buildAttributeFilter(filter));
    }

    return andConditions.length === 1
      ? andConditions[0]
      : { AND: andConditions };
  }

  private buildAttributeFilter(
    filter: ParsedAttributeFilter,
  ): Prisma.ProductVariantWhereInput {
    const definitionFilter = {
      productAttributeDefinition: {
        code: filter.code,
        active: true,
      },
    };

    switch (filter.operator) {
      case 'eq': {
        const numericValue = this.tryParseDecimal(filter.value);
        const orConditions: Prisma.VariantAttributeValueWhereInput[] = [
          { valueText: filter.value },
          { valueEnum: filter.value },
        ];

        if (numericValue) {
          orConditions.push({
            valueNumber: numericValue,
          });
        }

        return {
          attributeValues: {
            some: {
              ...definitionFilter,
              OR: orConditions,
            },
          },
        };
      }
      case 'gte':
        return this.buildNumericAttributeFilter(
          definitionFilter,
          'gte',
          filter.value,
        );
      case 'lte':
        return this.buildNumericAttributeFilter(
          definitionFilter,
          'lte',
          filter.value,
        );
      case 'gt':
        return this.buildNumericAttributeFilter(
          definitionFilter,
          'gt',
          filter.value,
        );
      case 'lt':
        return this.buildNumericAttributeFilter(
          definitionFilter,
          'lt',
          filter.value,
        );
      default:
        return {};
    }
  }

  private buildNumericAttributeFilter(
    definitionFilter: {
      productAttributeDefinition: {
        code: string;
        active: boolean;
      };
    },
    operator: 'gte' | 'lte' | 'gt' | 'lt',
    rawValue: string,
  ): Prisma.ProductVariantWhereInput {
    const value = this.tryParseDecimal(rawValue);

    if (!value) {
      return {
        id: '__invalid_numeric_filter__',
      };
    }

    return {
      attributeValues: {
        some: {
          ...definitionFilter,
          valueNumber: {
            [operator]: value,
          },
        },
      },
    };
  }

  private tryParseDecimal(rawValue: string) {
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      return null;
    }

    return new Prisma.Decimal(numericValue);
  }

  private resolveTake(limit?: string) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return 24;
    }

    return Math.min(parsed, 100);
  }

  private resolveSearchOrderBy(
    sort?: string,
  ): Prisma.ProductVariantOrderByWithRelationInput[] {
    const value = (sort ?? 'relevance') as VariantSort;

    switch (value) {
      case 'price_asc':
        return [{ price: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ price: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      case 'score':
      case 'relevance':
      default:
        return [{ score: 'desc' }, { createdAt: 'desc' }];
    }
  }

  private resolvePagination(page?: string, limit?: string) {
    const resolvedLimit = this.resolveTake(limit);
    const parsedPage = Number(page);
    const resolvedPage =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    return {
      page: resolvedPage,
      limit: resolvedLimit,
      skip: (resolvedPage - 1) * resolvedLimit,
    };
  }
}
