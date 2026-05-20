import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;
}
