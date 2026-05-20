import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxScope } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpsertTaxSettingDto {
  @ApiProperty({ enum: TaxScope })
  @IsEnum(TaxScope)
  scope: TaxScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent: number;
}
