import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeVietnamPhoneNumber } from '../../common/vietnam-phone';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
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

  findAllAdmin() {
    return this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: this.userSelect,
    });
  }

  async findOneAdmin(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createUser(input: {
    fullName?: string;
    dateOfBirth?: Date;
    email: string;
    phoneNumber?: string;
    password: string;
    role: AppRole;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = normalizeVietnamPhoneNumber(input.phoneNumber);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
        ],
      },
      select: {
        email: true,
        phoneNumber: true,
      },
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new ConflictException('Email already exists');
      }

      if (normalizedPhone && existingUser.phoneNumber === normalizedPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const passwordHash = await this.hashPassword(input.password);

    return this.prisma.user.create({
      data: {
        fullName: input.fullName?.trim() || null,
        dateOfBirth: input.dateOfBirth ?? null,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        passwordHash,
        role: input.role,
        active: true,
      },
      select: this.userSelect,
    });
  }

  async updateRole(id: string, role: AppRole) {
    await this.ensureUserExists(id);
    await this.preventRemovingLastAdmin(id, role);

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: this.userSelect,
    });
  }

  async updateStatus(id: string, active: boolean) {
    await this.ensureUserExists(id);
    await this.preventDeactivatingLastAdmin(id, active);

    return this.prisma.user.update({
      where: { id },
      data: {
        active,
        ...(active ? {} : { refreshTokenHash: null }),
      },
      select: this.userSelect,
    });
  }

  async resetPassword(id: string, password: string) {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await this.hashPassword(password),
        refreshTokenHash: null,
      },
      select: this.userSelect,
    });
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async preventRemovingLastAdmin(id: string, nextRole: AppRole) {
    if (nextRole === AppRole.ADMIN) {
      return;
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, active: true },
    });

    if (!current || current.role !== AppRole.ADMIN || !current.active) {
      return;
    }

    const adminCount = await this.prisma.user.count({
      where: { role: AppRole.ADMIN, active: true },
    });

    if (adminCount <= 1) {
      throw new BadRequestException('Cannot remove the last active admin');
    }
  }

  private async preventDeactivatingLastAdmin(id: string, active: boolean) {
    if (active) {
      return;
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, active: true },
    });

    if (!current || current.role !== AppRole.ADMIN || !current.active) {
      return;
    }

    const adminCount = await this.prisma.user.count({
      where: { role: AppRole.ADMIN, active: true },
    });

    if (adminCount <= 1) {
      throw new BadRequestException('Cannot deactivate the last active admin');
    }
  }

  private async hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}
