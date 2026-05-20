import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsEmail,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CheckoutAddressDto } from './checkout-address.dto';
import { InvoiceAddressDto } from './invoice-address.dto';

export class CreateCheckoutOrderDto {
  @ApiProperty({ example: ['2f3f8e15-2b3d-42af-a4dc-70cfc5a94715'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  cartItemIds: string[];

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  customerEmail?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @ApiPropertyOptional({ example: '9a05bc72-d3ee-4ff8-907e-084d5f6cf6a1' })
  @IsOptional()
  @IsUUID('4')
  shippingAddressId?: string;

  @ApiPropertyOptional({ type: CheckoutAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  invoiceRequested?: boolean;

  @ApiPropertyOptional({ example: '9a05bc72-d3ee-4ff8-907e-084d5f6cf6a1' })
  @IsOptional()
  @IsUUID('4')
  invoiceAddressId?: string;

  @ApiPropertyOptional({ type: InvoiceAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceAddressDto)
  invoiceAddress?: InvoiceAddressDto;

  @ApiPropertyOptional({ example: 'SALE10' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  voucherCode?: string;

  @ApiPropertyOptional({ example: 'Giao trong giờ hành chính' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerNote?: string;
}
