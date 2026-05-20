import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentSettingDto } from './create-payment-setting.dto';
import { UpdatePaymentSettingDto } from './update-payment-setting.dto';

type BuildVietQrInput = {
  orderCode: string;
  amount: Prisma.Decimal | string | number;
};

type BuildTestVietQrInput = {
  amount: Prisma.Decimal | string | number;
  note: string;
};

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  findAllSettings() {
    return this.prisma.paymentSetting.findMany({
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getActiveSetting() {
    const setting = await this.prisma.paymentSetting.findFirst({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!setting) {
      throw new NotFoundException('Active payment setting not found');
    }

    return setting;
  }

  async createSetting(data: CreatePaymentSettingDto) {
    return this.prisma.$transaction(async (tx) => {
      if (data.active === true) {
        await tx.paymentSetting.updateMany({
          where: { active: true },
          data: { active: false },
        });
      }

      return tx.paymentSetting.create({
        data: {
          provider: PaymentProvider.VIETQR,
          ...this.normalizeCreateInput(data),
          active: data.active ?? false,
        },
      });
    });
  }

  async updateSetting(id: string, data: UpdatePaymentSettingDto) {
    await this.ensureSettingExists(id);

    return this.prisma.$transaction(async (tx) => {
      if (data.active === true) {
        await tx.paymentSetting.updateMany({
          where: {
            active: true,
            id: { not: id },
          },
          data: { active: false },
        });
      }

      return tx.paymentSetting.update({
        where: { id },
        data: {
          ...this.normalizeUpdateInput(data),
          ...(data.active === undefined ? {} : { active: data.active }),
        },
      });
    });
  }

  async removeSetting(id: string) {
    await this.ensureSettingExists(id);

    await this.prisma.paymentSetting.delete({
      where: { id },
    });

    return { deleted: true };
  }

  async buildVietQrPayment(input: BuildVietQrInput) {
    const setting = await this.getActiveSetting();
    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(0);
    const transferContent = this.resolveTransferContent(
      setting.transferContentTemplate,
      input.orderCode,
    );

    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    return {
      paymentProvider: setting.provider,
      paymentBankCode: setting.bankCode,
      paymentBankName: setting.bankName,
      paymentBankAccountNumber: setting.accountNumber,
      paymentBankAccountName: setting.accountName,
      paymentTransferContent: transferContent,
      paymentQrUrl: this.buildVietQrUrl({
        bankCode: setting.bankCode,
        accountNumber: setting.accountNumber,
        accountName: setting.accountName,
        qrTemplate: setting.qrTemplate,
        amount: amount.toString(),
        transferContent,
      }),
    };
  }

  async buildTestVietQrPayment(input: BuildTestVietQrInput) {
    const setting = await this.getActiveSetting();
    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(0);
    const transferContent = input.note.trim();

    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (!transferContent) {
      throw new BadRequestException('Payment note is required');
    }

    return {
      paymentProvider: setting.provider,
      paymentBankCode: setting.bankCode,
      paymentBankName: setting.bankName,
      paymentBankAccountNumber: setting.accountNumber,
      paymentBankAccountName: setting.accountName,
      paymentTransferContent: transferContent,
      paymentQrUrl: this.buildVietQrUrl({
        bankCode: setting.bankCode,
        accountNumber: setting.accountNumber,
        accountName: setting.accountName,
        qrTemplate: setting.qrTemplate,
        amount: amount.toString(),
        transferContent,
      }),
    };
  }

  private async ensureSettingExists(id: string) {
    const setting = await this.prisma.paymentSetting.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!setting) {
      throw new NotFoundException('Payment setting not found');
    }
  }

  private normalizeCreateInput(data: CreatePaymentSettingDto) {
    return {
      bankCode: data.bankCode.trim(),
      bankName: data.bankName.trim(),
      accountNumber: data.accountNumber.trim(),
      accountName: data.accountName.trim(),
      qrTemplate: data.qrTemplate?.trim() || 'compact2',
      transferContentTemplate:
        data.transferContentTemplate?.trim() || 'AHSO {orderCode}',
    };
  }

  private normalizeUpdateInput(data: UpdatePaymentSettingDto) {
    return {
      ...(data.bankCode === undefined
        ? {}
        : { bankCode: data.bankCode.trim() }),
      ...(data.bankName === undefined
        ? {}
        : { bankName: data.bankName.trim() }),
      ...(data.accountNumber === undefined
        ? {}
        : { accountNumber: data.accountNumber.trim() }),
      ...(data.accountName === undefined
        ? {}
        : { accountName: data.accountName.trim() }),
      ...(data.qrTemplate === undefined
        ? {}
        : { qrTemplate: data.qrTemplate.trim() || 'compact2' }),
      ...(data.transferContentTemplate === undefined
        ? {}
        : {
            transferContentTemplate:
              data.transferContentTemplate.trim() || 'AHSO {orderCode}',
          }),
    };
  }

  private resolveTransferContent(template: string, orderCode: string) {
    return template.replaceAll('{orderCode}', orderCode).trim();
  }

  private buildVietQrUrl(input: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    qrTemplate: string;
    amount: string;
    transferContent: string;
  }) {
    const query = new URLSearchParams({
      amount: input.amount,
      addInfo: input.transferContent,
      accountName: input.accountName,
    });

    return `https://img.vietqr.io/image/${encodeURIComponent(
      input.bankCode,
    )}-${encodeURIComponent(input.accountNumber)}-${encodeURIComponent(
      input.qrTemplate,
    )}.png?${query.toString()}`;
  }
}
