import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ReviewPaymentDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ example: 'Không tìm thấy giao dịch đúng nội dung' })
  @ValidateIf((data: ReviewPaymentDto) => data.action === 'REJECT')
  @IsString()
  @MaxLength(255)
  rejectReason?: string;

  @ApiPropertyOptional({ example: 'Đã đối soát sao kê ngân hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  staffNote?: string;
}
