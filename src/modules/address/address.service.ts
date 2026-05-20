import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserAddressDto } from './create-user-address.dto';
import { UpdateUserAddressDto } from './update-user-address.dto';

const USER_ADDRESS_LIMIT = 5;

type NormalizedCreateAddressInput = Omit<
  CreateUserAddressDto,
  'status' | 'phoneNumber' | 'note'
> & {
  phoneNumber?: string | null;
  note?: string | null;
};

type NormalizedUpdateAddressInput = Partial<NormalizedCreateAddressInput>;

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async create(userId: string, data: CreateUserAddressDto) {
    const addressCount = await this.prisma.userAddress.count({
      where: { userId },
    });

    if (addressCount >= USER_ADDRESS_LIMIT) {
      throw new BadRequestException(
        `Each user can save up to ${USER_ADDRESS_LIMIT} addresses`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.status === true) {
        await this.clearDefaultAddresses(tx, userId);
      }

      return tx.userAddress.create({
        data: {
          userId,
          ...this.normalizeCreateAddressInput(data),
          status: data.status ?? false,
        },
      });
    });
  }

  async update(userId: string, addressId: string, data: UpdateUserAddressDto) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (data.status === true) {
        await this.clearDefaultAddresses(tx, userId, addressId);
      }

      return tx.userAddress.update({
        where: { id: addressId },
        data: {
          ...this.normalizeUpdateAddressInput(data),
          ...(data.status === undefined ? {} : { status: data.status }),
        },
      });
    });
  }

  async setDefault(userId: string, addressId: string) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      await this.clearDefaultAddresses(tx, userId, addressId);

      return tx.userAddress.update({
        where: { id: addressId },
        data: { status: true },
      });
    });
  }

  async remove(userId: string, addressId: string) {
    await this.ensureAddressBelongsToUser(userId, addressId);

    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });

    return { deleted: true };
  }

  private async ensureAddressBelongsToUser(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },
      select: { id: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }
  }

  private clearDefaultAddresses(
    tx: Prisma.TransactionClient,
    userId: string,
    excludeAddressId?: string,
  ) {
    return tx.userAddress.updateMany({
      where: {
        userId,
        status: true,
        ...(excludeAddressId ? { id: { not: excludeAddressId } } : {}),
      },
      data: { status: false },
    });
  }

  private normalizeCreateAddressInput(
    data: CreateUserAddressDto,
  ): NormalizedCreateAddressInput {
    return {
      label: data.label.trim(),
      name: data.name.trim(),
      phoneNumber: data.phoneNumber?.trim() || null,
      provinceCode: data.provinceCode.trim(),
      provinceName: data.provinceName.trim(),
      wardCode: data.wardCode.trim(),
      wardName: data.wardName.trim(),
      streetAddress: data.streetAddress.trim(),
      note: data.note?.trim() || null,
    };
  }

  private normalizeUpdateAddressInput(
    data: UpdateUserAddressDto,
  ): NormalizedUpdateAddressInput {
    return {
      ...(data.label === undefined ? {} : { label: data.label.trim() }),
      ...(data.name === undefined ? {} : { name: data.name.trim() }),
      ...(data.phoneNumber === undefined
        ? {}
        : { phoneNumber: data.phoneNumber.trim() || null }),
      ...(data.provinceCode === undefined
        ? {}
        : { provinceCode: data.provinceCode.trim() }),
      ...(data.provinceName === undefined
        ? {}
        : { provinceName: data.provinceName.trim() }),
      ...(data.wardCode === undefined
        ? {}
        : { wardCode: data.wardCode.trim() }),
      ...(data.wardName === undefined
        ? {}
        : { wardName: data.wardName.trim() }),
      ...(data.streetAddress === undefined
        ? {}
        : { streetAddress: data.streetAddress.trim() }),
      ...(data.note === undefined ? {} : { note: data.note.trim() || null }),
    };
  }
}
