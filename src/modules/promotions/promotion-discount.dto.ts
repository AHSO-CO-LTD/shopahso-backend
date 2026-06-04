import { ApiPropertyOptional } from '@nestjs/swagger';
import { PromotionDiscountType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PromotionDiscountDto {
  @ApiPropertyOptional({ enum: PromotionDiscountType })
  @IsOptional()
  @IsEnum(PromotionDiscountType)
  discountType?: PromotionDiscountType;

  @ApiPropertyOptional({
    description:
      'Gia tri giam gia. Neu type la PERCENT thi nhap 0-100, neu FIXED_AMOUNT thi nhap so tien giam.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999)
  discountValue?: number;
}
