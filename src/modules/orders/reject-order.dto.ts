import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class RejectOrderDto {
  @ApiProperty({ example: 'Khong the xac nhan thong tin don hang' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional({ example: 'Da lien he khach nhung khong thanh cong' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  staffNote?: string;
}
