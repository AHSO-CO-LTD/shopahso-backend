import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class TestMailDto {
  @ApiProperty({ example: 'admin@gmail.com' })
  @IsEmail()
  email: string;
}
