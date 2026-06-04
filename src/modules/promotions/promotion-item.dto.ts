import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PromotionDiscountDto } from './promotion-discount.dto';

export class PromotionItemDto extends PromotionDiscountDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;
}

export class AddPromotionItemDto extends PromotionItemDto {}

export class UpdatePromotionItemDto extends PromotionDiscountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;
}
