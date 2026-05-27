import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsVietnamPhoneNumber } from '../../common/vietnam-phone';

export class CreateQuoteRequestDto {
  @ApiProperty({
    example: ['2f3f8e15-2b3d-42af-a4dc-70cfc5a94715'],
    description: 'One or more CONTACT_FOR_PRICE variant ids.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  variantIds: string[];

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  @MaxLength(120)
  email: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsVietnamPhoneNumber()
  @MaxLength(20)
  phoneNumber: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity?: number;

  @ApiPropertyOptional({ example: 'Can bao gia som trong gio hanh chinh' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
