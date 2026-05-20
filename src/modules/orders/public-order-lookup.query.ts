import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class PublicOrderLookupQuery {
  @ApiProperty({ example: 'DH20260520AB12CD34' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  orderCode: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  @MaxLength(120)
  email: string;
}
