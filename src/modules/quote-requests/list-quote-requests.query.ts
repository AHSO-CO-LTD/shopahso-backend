import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListQuoteRequestsQuery {
  @ApiPropertyOptional({ enum: QuoteRequestStatus })
  @IsOptional()
  @IsEnum(QuoteRequestStatus)
  status?: QuoteRequestStatus;

  @ApiPropertyOptional({ example: 'RFQ20260527' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  requestCode?: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
}
