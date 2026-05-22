import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ example: 'Khach yeu cau huy don' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional({ example: 'Da hoan ton kho sau khi huy' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  staffNote?: string;
}
