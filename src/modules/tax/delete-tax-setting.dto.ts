import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxScope } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class DeleteTaxSettingDto {
  @ApiProperty({ enum: TaxScope })
  @IsEnum(TaxScope)
  scope: TaxScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetId?: string;
}
