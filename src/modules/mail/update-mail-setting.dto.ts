import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsOptional } from 'class-validator';

export class UpdateMailSettingDto {
  @ApiPropertyOptional({
    example: ['admin1@gmail.com', 'admin2@gmail.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  adminOrderRecipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyRegistrationCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOrderCreatedCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOrderStatusCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOrderCreatedAdmin?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOrderCompletedAdmin?: boolean;
}
