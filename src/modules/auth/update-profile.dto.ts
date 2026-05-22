import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsVietnamPhoneNumber } from '../../common/vietnam-phone';

export class UpdateProfileDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string | null;

  @ApiPropertyOptional({
    example: '1998-04-20T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsVietnamPhoneNumber()
  phoneNumber?: string | null;
}
