import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import { IsVietnamPhoneNumber } from '../../common/vietnam-phone';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({
    example: '1998-04-20T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  dateOfBirth: Date;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsVietnamPhoneNumber()
  phoneNumber?: string;

  @ApiProperty()
  @IsStrongPassword({
    minLength: 10,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
