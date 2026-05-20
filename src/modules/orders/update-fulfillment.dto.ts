import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FulfillmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFulfillmentDto {
  @ApiProperty({
    enum: [
      FulfillmentStatus.PROCESSING,
      FulfillmentStatus.READY_TO_SHIP,
      FulfillmentStatus.SHIPPING,
      FulfillmentStatus.DELIVERED,
      FulfillmentStatus.FAILED,
      FulfillmentStatus.RETURNED,
    ],
  })
  @IsEnum(FulfillmentStatus)
  fulfillmentStatus: FulfillmentStatus;

  @ApiPropertyOptional({ example: 'Đơn đã bàn giao vận chuyển' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  staffNote?: string;
}
