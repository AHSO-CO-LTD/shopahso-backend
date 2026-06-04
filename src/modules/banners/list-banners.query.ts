import { ApiPropertyOptional } from '@nestjs/swagger';
import { BannerPlacement } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';

export class ListBannersQuery {
  @ApiPropertyOptional({ enum: BannerPlacement })
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const input: unknown = value;

    if (input === 'true') {
      return true;
    }

    if (input === 'false') {
      return false;
    }

    return input;
  })
  @IsBoolean()
  active?: boolean;
}
