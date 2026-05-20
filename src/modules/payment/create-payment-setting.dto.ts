import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePaymentSettingDto {
  @ApiProperty({ example: '970436' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  bankCode: string;

  @ApiProperty({ example: 'Vietcombank' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  accountNumber: string;

  @ApiProperty({ example: 'CONG TY AHSO' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  accountName: string;

  @ApiPropertyOptional({ default: 'compact2', example: 'compact2' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  qrTemplate?: string;

  @ApiPropertyOptional({
    default: 'AHSO {orderCode}',
    example: 'AHSO {orderCode}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  transferContentTemplate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
