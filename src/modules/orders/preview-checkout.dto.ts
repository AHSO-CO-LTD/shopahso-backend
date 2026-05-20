import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class PreviewCheckoutDto {
  @ApiProperty({ example: ['2f3f8e15-2b3d-42af-a4dc-70cfc5a94715'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  cartItemIds: string[];
}
