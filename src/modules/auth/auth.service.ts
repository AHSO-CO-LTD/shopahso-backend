import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AppRole, Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { timingSafeEqual } from 'crypto';
import { normalizeVietnamPhoneNumber } from '../../common/vietnam-phone';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthConfigService } from './auth-config.service';
import { JwtUserPayload } from './auth.types';
import { UpdateProfileDto } from './update-profile.dto';

type RegisterUserInput = {
  fullName: string;
  dateOfBirth: Date;
  email: string;
  phoneNumber?: string;
  password: string;
};

@Injectable()
export class AuthService {
  private readonly profileSelect = {
    id: true,
    fullName: true,
    dateOfBirth: true,
    email: true,
    phoneNumber: true,
    role: true,
    active: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
    private readonly mailService: MailService,
  ) {}

  async bootstrapAdmin(email: string, password: string, bootstrapKey: string) {
    this.assertBootstrapKey(bootstrapKey);

    const adminCount = await this.prisma.user.count({
      where: { role: AppRole.ADMIN },
    });

    if (adminCount > 0) {
      throw new ForbiddenException('Bootstrap admin is no longer available');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const passwordHash = await this.hashSecret(password);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: AppRole.ADMIN,
        active: true,
      },
    });

    return this.issueAuthTokens(user.id, user.email, user.role);
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueAuthTokens(user.id, user.email, user.role, true);
  }

  async register(input: RegisterUserInput) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedPhone = normalizeVietnamPhoneNumber(input.phoneNumber);
    const passwordHash = await this.hashSecret(input.password);

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        dateOfBirth: input.dateOfBirth,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        passwordHash,
        role: AppRole.USER,
        active: true,
      },
    });

    await this.mailService.notifyRegistrationCustomer({
      fullName: user.fullName,
      email: user.email,
    });

    return this.issueAuthTokens(user.id, user.email, user.role, true);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.active || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueAuthTokens(user.id, user.email, user.role, true);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
      },
    });

    return { success: true };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: this.profileSelect,
    });
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};

    if (Object.hasOwn(input, 'fullName')) {
      data.fullName = input.fullName?.trim() || null;
    }

    if (Object.hasOwn(input, 'dateOfBirth')) {
      data.dateOfBirth = input.dateOfBirth ?? null;
    }

    if (Object.hasOwn(input, 'phoneNumber')) {
      data.phoneNumber = normalizeVietnamPhoneNumber(input.phoneNumber);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No profile fields provided');
    }

    if (typeof data.phoneNumber === 'string') {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          phoneNumber: data.phoneNumber,
          id: { not: userId },
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new ConflictException('Phone number already exists');
      }
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: this.profileSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Phone number already exists');
      }

      throw error;
    }
  }

  private async issueAuthTokens(
    userId: string,
    email: string,
    role: AppRole,
    updateLoginState = false,
  ) {
    const accessPayload: JwtUserPayload = {
      sub: userId,
      email,
      role,
      type: 'access',
    };

    const refreshPayload: JwtUserPayload = {
      ...accessPayload,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.authConfigService.accessSecret,
        expiresIn: this.authConfigService.accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.authConfigService.refreshSecret,
        expiresIn: this.authConfigService.refreshExpiresIn,
      }),
    ]);

    const refreshTokenHash = await this.hashSecret(refreshToken);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash,
        ...(updateLoginState ? { lastLoginAt: new Date() } : {}),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        role,
      },
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(
        refreshToken,
        {
          secret: this.authConfigService.refreshSecret,
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async hashSecret(secret: string) {
    return argon2.hash(secret, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private assertBootstrapKey(receivedKey: string) {
    const expected = Buffer.from(this.authConfigService.bootstrapAdminKey);
    const received = Buffer.from(receivedKey ?? '');

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new ForbiddenException('Invalid bootstrap key');
    }
  }
}
