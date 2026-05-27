import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class QuoteRequestStaffNoteDto {
  @ApiPropertyOptional({ example: 'Da nhan xu ly va se lien he khach' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  staffNote?: string;
}
