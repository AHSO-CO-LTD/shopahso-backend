import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { VariantService } from './variant.service';
import { ListVariantsQuery } from './list-variants.query';

@Controller('catalog/variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Get()
  findAll(@Query() query: Record<string, string | string[] | undefined>) {
    return this.variantService.findAll(this.parseListQuery(query));
  }

  @Get('search')
  search(@Query() query: Record<string, string | string[] | undefined>) {
    return this.variantService.search(this.parseListQuery(query));
  }

  @Get('featured')
  findFeatured(@Query() query: Record<string, string | string[] | undefined>) {
    return this.variantService.findFeatured(this.parseListQuery(query));
  }

  @Get('newest')
  findNewest(@Query() query: Record<string, string | string[] | undefined>) {
    return this.variantService.findNewest(this.parseListQuery(query));
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const variant = await this.variantService.findBySlug(slug);

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  private parseListQuery(
    query: Record<string, string | string[] | undefined>,
  ): ListVariantsQuery {
    const readValue = (key: string) => {
      const value = query[key];
      return Array.isArray(value) ? value[0] : value;
    };

    const attrFilters = Object.entries(query)
      .filter(([key]) => key.startsWith('attr.'))
      .flatMap(([key, rawValue]) => {
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        if (value === undefined) {
          return [];
        }

        const parts = key.split('.');
        if (parts.length < 2) {
          return [];
        }

        const code = parts[1];
        const operator = parts[2] ?? 'eq';

        if (!['eq', 'gte', 'lte', 'gt', 'lt'].includes(operator)) {
          return [];
        }

        return [
          {
            code,
            operator:
              operator as ListVariantsQuery['attrFilters'][number]['operator'],
            value,
          },
        ];
      });

    return {
      q: readValue('q'),
      productId: readValue('productId'),
      categoryId: readValue('categoryId'),
      brandId: readValue('brandId'),
      originCountryCode: readValue('originCountryCode'),
      priceMin: readValue('priceMin'),
      priceMax: readValue('priceMax'),
      page: readValue('page'),
      limit: readValue('limit'),
      sort: readValue('sort'),
      attrFilters,
    };
  }
}
