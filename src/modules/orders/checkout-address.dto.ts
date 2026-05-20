import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckoutAddressDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

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

  @ApiPropertyOptional({ example: 'Giao giờ hành chính' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
