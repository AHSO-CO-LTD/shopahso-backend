import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InvoiceAddressDto {
  @ApiProperty({ example: 'Công ty TNHH AHSO' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH AHSO' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional({ example: '0312345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  taxCode?: string;

  @ApiPropertyOptional({ example: 'invoice@ahso.vn' })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiProperty({ example: '79' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  provinceCode: string;

  @ApiProperty({ example: 'Thành phố Hồ Chí Minh' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provinceName: string;

  @ApiProperty({ example: '26734' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  wardCode: string;

  @ApiProperty({ example: 'Phường Sài Gòn' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  wardName: string;

  @ApiProperty({ example: '123 Nguyễn Huệ' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  streetAddress: string;
}
