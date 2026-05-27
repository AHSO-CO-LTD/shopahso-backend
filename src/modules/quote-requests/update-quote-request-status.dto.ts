import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQuoteRequestStatusDto {
  @ApiProperty({ enum: QuoteRequestStatus })
  @IsEnum(QuoteRequestStatus)
  status: QuoteRequestStatus;

  @ApiPropertyOptional({ example: 'Da lien he khach qua dien thoai' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  staffNote?: string;
}
