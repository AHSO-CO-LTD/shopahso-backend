import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  bannerUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
