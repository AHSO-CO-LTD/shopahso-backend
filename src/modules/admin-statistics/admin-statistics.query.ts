import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export type StatisticsPreset = 'today' | '7d' | '30d' | 'month' | 'year';
export type StatisticsInterval = 'day' | 'week' | 'month';

export class AdminStatisticsQuery {
  @ApiPropertyOptional({
    enum: ['today', '7d', '30d', 'month', 'year'],
    default: '30d',
  })
  @IsOptional()
  @IsIn(['today', '7d', '30d', 'month', 'year'])
  preset?: StatisticsPreset;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  interval?: StatisticsInterval;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  topLimit?: number;
}
