import { ApiPropertyOptional } from '@nestjs/swagger';
import { PromotionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListPromotionsQuery {
  @ApiPropertyOptional({ enum: PromotionStatus })
  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
