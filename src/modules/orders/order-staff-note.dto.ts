import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OrderStaffNoteDto {
  @ApiPropertyOptional({ example: 'Da goi xac nhan voi khach hang' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  staffNote?: string;
}
