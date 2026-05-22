import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { BootstrapAdminDto } from './bootstrap-admin.dto';
import { RegisterDto } from './register.dto';
import { UpdateProfileDto } from './update-profile.dto';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtUserPayload } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('bootstrap-admin')
  bootstrapAdmin(
    @Body() body: BootstrapAdminDto,
    @Headers('x-bootstrap-key') bootstrapKey?: string,
  ) {
    if (!bootstrapKey) {
      throw new UnauthorizedException('Missing bootstrap key');
    }

    return this.authService.bootstrapAdmin(
      body.email,
      body.password,
      bootstrapKey,
    );
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register({
      fullName: body.fullName,
      dateOfBirth: body.dateOfBirth,
      email: body.email,
      phoneNumber: body.phoneNumber,
      password: body.password,
    });
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser() user?: JwtUserPayload) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.logout(user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user?: JwtUserPayload) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.getProfile(user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtUserPayload | undefined,
    @Body() body: UpdateProfileDto,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authService.updateProfile(user.sub, body);
  }
}
