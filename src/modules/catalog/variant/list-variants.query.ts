export type AttributeFilterOperator = 'eq' | 'gte' | 'lte' | 'gt' | 'lt';

export type ParsedAttributeFilter = {
  code: string;
  operator: AttributeFilterOperator;
  value: string;
};

export type VariantSort =
  | 'relevance'
  | 'score'
  | 'newest'
  | 'price_asc'
  | 'price_desc';

export type ListVariantsQuery = {
  q?: string;
  productId?: string;
  categoryId?: string;
  brandId?: string;
  originCountryCode?: string;
  priceMin?: string;
  priceMax?: string;
  page?: string;
  limit?: string;
  sort?: string;
  attrFilters: ParsedAttributeFilter[];
};
