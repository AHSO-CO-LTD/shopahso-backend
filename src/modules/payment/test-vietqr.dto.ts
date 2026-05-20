import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumberString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TestVietQrDto {
  @ApiProperty({ example: '10000' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ example: 'TEST QR AHSO' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  note: string;
}
