import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  MaxLength,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  datasheetUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
    },
    { each: true },
  )
  imageUrls?: string[];

  @ApiPropertyOptional({ enum: PRODUCT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatusValue;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
