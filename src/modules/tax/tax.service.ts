import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaxScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeleteTaxSettingDto } from './delete-tax-setting.dto';
import { UpsertTaxSettingDto } from './upsert-tax-setting.dto';

type TaxTargetInput = {
  scope: TaxScope;
  targetId?: string | null;
};

type TaxLookupInput = {
  categoryId: string;
  productId: string;
  variantId: string;
};

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.taxSetting.findMany({
      orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
    });

    const [categories, products, variants] = await Promise.all([
      this.prisma.category.findMany({
        where: {
          id: {
            in: settings
              .filter((setting) => setting.scope === TaxScope.CATEGORY)
              .flatMap((setting) =>
                setting.targetId ? [setting.targetId] : [],
              ),
          },
        },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.product.findMany({
        where: {
          id: {
            in: settings
              .filter((setting) => setting.scope === TaxScope.PRODUCT)
              .flatMap((setting) =>
                setting.targetId ? [setting.targetId] : [],
              ),
          },
        },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.productVariant.findMany({
        where: {
          id: {
            in: settings
              .filter((setting) => setting.scope === TaxScope.VARIANT)
              .flatMap((setting) =>
                setting.targetId ? [setting.targetId] : [],
              ),
          },
        },
        select: { id: true, name: true, slug: true, sku: true },
      }),
    ]);

    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    const productMap = new Map(products.map((item) => [item.id, item]));
    const variantMap = new Map(variants.map((item) => [item.id, item]));

    return settings.map((setting) => ({
      id: setting.id,
      scope: setting.scope,
      targetId: setting.targetId,
      target: this.resolveTargetSnapshot(setting, {
        categoryMap,
        productMap,
        variantMap,
      }),
      taxPercent: setting.taxPercent.toString(),
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    }));
  }

  async upsert(data: UpsertTaxSettingDto) {
    await this.validateTarget(data);
    const targetKey = this.resolveTargetKey(data);

    const setting = await this.prisma.taxSetting.upsert({
      where: {
        scope_targetKey: {
          scope: data.scope,
          targetKey,
        },
      },
      update: {
        targetId: data.scope === TaxScope.GLOBAL ? null : data.targetId,
        taxPercent: new Prisma.Decimal(data.taxPercent),
      },
      create: {
        scope: data.scope,
        targetId: data.scope === TaxScope.GLOBAL ? null : data.targetId,
        targetKey,
        taxPercent: new Prisma.Decimal(data.taxPercent),
      },
    });

    return {
      ...setting,
      taxPercent: setting.taxPercent.toString(),
    };
  }

  async remove(data: DeleteTaxSettingDto) {
    this.validateTargetShape(data);
    const targetKey = this.resolveTargetKey(data);
    const setting = await this.prisma.taxSetting.findUnique({
      where: {
        scope_targetKey: {
          scope: data.scope,
          targetKey,
        },
      },
      select: { id: true },
    });

    if (!setting) {
      throw new NotFoundException('Tax setting not found');
    }

    await this.prisma.taxSetting.delete({
      where: { id: setting.id },
    });

    return { deleted: true };
  }

  async resolveEffectiveTax(input: TaxLookupInput) {
    const settings = await this.prisma.taxSetting.findMany({
      where: {
        OR: [
          { scope: TaxScope.VARIANT, targetKey: input.variantId },
          { scope: TaxScope.PRODUCT, targetKey: input.productId },
          { scope: TaxScope.CATEGORY, targetKey: input.categoryId },
          { scope: TaxScope.GLOBAL, targetKey: TaxScope.GLOBAL },
        ],
      },
    });

    const order = [
      { scope: TaxScope.VARIANT, targetKey: input.variantId },
      { scope: TaxScope.PRODUCT, targetKey: input.productId },
      { scope: TaxScope.CATEGORY, targetKey: input.categoryId },
      { scope: TaxScope.GLOBAL, targetKey: TaxScope.GLOBAL },
    ];

    for (const candidate of order) {
      const setting = settings.find(
        (item) =>
          item.scope === candidate.scope &&
          item.targetKey === candidate.targetKey,
      );

      if (setting) {
        return {
          scope: setting.scope,
          targetId: setting.targetId,
          taxPercent: setting.taxPercent,
        };
      }
    }

    return {
      scope: null,
      targetId: null,
      taxPercent: new Prisma.Decimal(0),
    };
  }

  private async validateTarget(data: TaxTargetInput) {
    this.validateTargetShape(data);

    if (data.scope === TaxScope.GLOBAL) {
      return;
    }

    const targetId = data.targetId!;
    const exists = await this.targetExists(data.scope, targetId);

    if (!exists) {
      throw new NotFoundException(`${this.formatScope(data.scope)} not found`);
    }
  }

  private validateTargetShape(data: TaxTargetInput) {
    if (data.scope === TaxScope.GLOBAL) {
      if (data.targetId) {
        throw new BadRequestException(
          'Global tax setting must not have targetId',
        );
      }
      return;
    }

    if (!data.targetId) {
      throw new BadRequestException(
        `${this.formatScope(data.scope)} targetId is required`,
      );
    }
  }

  private async targetExists(scope: TaxScope, targetId: string) {
    switch (scope) {
      case TaxScope.CATEGORY:
        return Boolean(
          await this.prisma.category.findUnique({
            where: { id: targetId },
            select: { id: true },
          }),
        );
      case TaxScope.PRODUCT:
        return Boolean(
          await this.prisma.product.findUnique({
            where: { id: targetId },
            select: { id: true },
          }),
        );
      case TaxScope.VARIANT:
        return Boolean(
          await this.prisma.productVariant.findUnique({
            where: { id: targetId },
            select: { id: true },
          }),
        );
      case TaxScope.GLOBAL:
      default:
        return true;
    }
  }

  private resolveTargetKey(data: TaxTargetInput) {
    return data.scope === TaxScope.GLOBAL ? TaxScope.GLOBAL : data.targetId!;
  }

  private formatScope(scope: TaxScope) {
    return scope.toLowerCase();
  }

  private resolveTargetSnapshot(
    setting: {
      scope: TaxScope;
      targetId: string | null;
    },
    maps: {
      categoryMap: Map<string, { id: string; name: string; slug: string }>;
      productMap: Map<string, { id: string; name: string; slug: string }>;
      variantMap: Map<
        string,
        { id: string; name: string; slug: string; sku: string }
      >;
    },
  ) {
    if (!setting.targetId) {
      return null;
    }

    switch (setting.scope) {
      case TaxScope.CATEGORY:
        return maps.categoryMap.get(setting.targetId) ?? null;
      case TaxScope.PRODUCT:
        return maps.productMap.get(setting.targetId) ?? null;
      case TaxScope.VARIANT:
        return maps.variantMap.get(setting.targetId) ?? null;
      case TaxScope.GLOBAL:
      default:
        return null;
    }
  }
}
