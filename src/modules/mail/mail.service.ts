import { Injectable, Logger } from '@nestjs/common';
import { MailSetting, Prisma } from '@prisma/client';
import { createTransport, Transporter } from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { MailConfigService } from './mail-config.service';
import { MailTemplatesService } from './mail-templates.service';
import { UpdateMailSettingDto } from './update-mail-setting.dto';

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MailConfigService,
    private readonly templates: MailTemplatesService,
  ) {}

  async getSetting() {
    const existing = await this.prisma.mailSetting.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.mailSetting.create({
      data: {
        adminOrderRecipients: this.resolveFallbackAdminRecipients(),
      },
    });
  }

  async updateSetting(data: UpdateMailSettingDto) {
    const setting = await this.getSetting();

    return this.prisma.mailSetting.update({
      where: { id: setting.id },
      data: {
        ...(data.adminOrderRecipients === undefined
          ? {}
          : {
              adminOrderRecipients: [
                ...new Set(
                  data.adminOrderRecipients.map((email) =>
                    email.trim().toLowerCase(),
                  ),
                ),
              ],
            }),
        ...(data.notifyRegistrationCustomer === undefined
          ? {}
          : { notifyRegistrationCustomer: data.notifyRegistrationCustomer }),
        ...(data.notifyOrderCreatedCustomer === undefined
          ? {}
          : { notifyOrderCreatedCustomer: data.notifyOrderCreatedCustomer }),
        ...(data.notifyOrderStatusCustomer === undefined
          ? {}
          : { notifyOrderStatusCustomer: data.notifyOrderStatusCustomer }),
        ...(data.notifyOrderCreatedAdmin === undefined
          ? {}
          : { notifyOrderCreatedAdmin: data.notifyOrderCreatedAdmin }),
        ...(data.notifyOrderCompletedAdmin === undefined
          ? {}
          : { notifyOrderCompletedAdmin: data.notifyOrderCompletedAdmin }),
      },
    });
  }

  async sendTestMail(to: string) {
    const template = this.templates.test({ email: to.trim().toLowerCase() });
    await this.sendMail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return { sent: true };
  }

  async notifyRegistrationCustomer(user: {
    fullName: string | null;
    email: string;
  }) {
    await this.runNotification('registration customer', async (setting) => {
      if (!setting.notifyRegistrationCustomer) {
        return;
      }

      const template = this.templates.welcome({
        fullName: user.fullName,
        email: user.email,
        shopUrl: this.config.shopUrl,
      });

      await this.sendMail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    });
  }

  async notifyOrderCreated(orderId: string) {
    await this.runNotification('order created', async (setting) => {
      const order = await this.findOrder(orderId);
      const tasks: Promise<void>[] = [];

      if (setting.notifyOrderCreatedCustomer && order.customerEmail) {
        const lookupUrl = this.buildOrderLookupUrl(order);
        const template = this.templates.orderCreatedForCustomer({
          order,
          lookupUrl,
        });

        tasks.push(
          this.sendMail({
            to: order.customerEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          }),
        );
      }

      if (
        setting.notifyOrderCreatedAdmin &&
        setting.adminOrderRecipients.length > 0
      ) {
        const template = this.templates.orderCreatedForAdmin({
          order,
          backofficeUrl: this.buildBackofficeOrderUrl(order.id),
        });

        tasks.push(
          this.sendMail({
            to: setting.adminOrderRecipients,
            subject: template.subject,
            html: template.html,
            text: template.text,
          }),
        );
      }

      await Promise.all(tasks);
    });
  }

  async notifyOrderStatusChanged(orderId: string) {
    await this.runNotification('order status changed', async (setting) => {
      if (!setting.notifyOrderStatusCustomer) {
        return;
      }

      const order = await this.findOrder(orderId);
      if (!order.customerEmail) {
        return;
      }

      const template = this.templates.orderStatusForCustomer({
        order,
        lookupUrl: this.buildOrderLookupUrl(order),
      });

      await this.sendMail({
        to: order.customerEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    });
  }

  async notifyOrderCompletedAdmin(orderId: string) {
    await this.runNotification('order completed admin', async (setting) => {
      if (
        !setting.notifyOrderCompletedAdmin ||
        setting.adminOrderRecipients.length === 0
      ) {
        return;
      }

      const order = await this.findOrder(orderId);
      const template = this.templates.orderCompletedForAdmin({
        order,
        backofficeUrl: this.buildBackofficeOrderUrl(order.id),
      });

      await this.sendMail({
        to: setting.adminOrderRecipients,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    });
  }

  async notifyQuoteRequestCreated(requestIds: string[]) {
    await this.runNotification('quote request created', async (setting) => {
      const requests = await this.findQuoteRequests(requestIds);
      if (requests.length === 0) {
        return;
      }

      const tasks: Promise<void>[] = [];
      const customerEmail = requests[0].customerEmail;

      const customerTemplate = this.templates.quoteRequestCreatedForCustomer({
        requests,
      });
      tasks.push(
        this.sendMail({
          to: customerEmail,
          subject: customerTemplate.subject,
          html: customerTemplate.html,
          text: customerTemplate.text,
        }),
      );

      if (setting.adminOrderRecipients.length > 0) {
        const adminTemplate = this.templates.quoteRequestCreatedForAdmin({
          requests,
          backofficeUrl: this.buildBackofficeQuoteRequestUrl(
            requests[0].requestGroupCode,
          ),
        });

        tasks.push(
          this.sendMail({
            to: setting.adminOrderRecipients,
            subject: adminTemplate.subject,
            html: adminTemplate.html,
            text: adminTemplate.text,
          }),
        );
      }

      await Promise.all(tasks);
    });
  }

  async notifyQuoteRequestStatusChanged(requestId: string) {
    await this.runNotification('quote request status changed', async () => {
      const request = await this.findQuoteRequest(requestId);
      const template = this.templates.quoteRequestStatusForCustomer({
        request,
      });

      await this.sendMail({
        to: request.customerEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    });
  }

  private async runNotification(
    label: string,
    callback: (setting: MailSetting) => Promise<void>,
  ) {
    try {
      const setting = await this.getSetting();
      await callback(setting);
    } catch (error) {
      this.logger.error(
        `Failed to send ${label} email`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async sendMail(input: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
  }) {
    if (!this.config.enabled) {
      this.logger.warn('Mail SMTP config is incomplete; email was skipped');
      return;
    }

    const result: unknown = await this.getTransporter().sendMail({
      from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    const accepted = this.resolveAcceptedRecipients(result);

    this.logger.log(`Mail sent: ${input.subject} -> ${accepted.join(', ')}`);
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
      });
    }

    return this.transporter;
  }

  private findOrder(orderId: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
  }

  private findQuoteRequests(requestIds: string[]) {
    return this.prisma.quoteRequest.findMany({
      where: { id: { in: requestIds } },
      orderBy: { createdAt: 'asc' },
      include: { product: true, variant: true },
    });
  }

  private findQuoteRequest(requestId: string) {
    return this.prisma.quoteRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { product: true, variant: true },
    });
  }

  private buildOrderLookupUrl(order: OrderWithItems) {
    const params = new URLSearchParams({
      orderCode: order.orderCode,
      email: order.customerEmail ?? '',
    });

    return `${this.config.shopUrl}/orders/lookup?${params.toString()}`;
  }

  private buildBackofficeOrderUrl(orderId: string) {
    return `${this.config.backofficeOrderUrl}/${encodeURIComponent(orderId)}`;
  }

  private buildBackofficeQuoteRequestUrl(requestGroupCode: string) {
    const params = new URLSearchParams({ requestCode: requestGroupCode });
    return `${this.config.backofficeQuoteRequestUrl}?${params.toString()}`;
  }

  private resolveFallbackAdminRecipients() {
    return [
      ...new Set(
        (process.env.MAIL_ADMIN_RECIPIENTS ?? '')
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  private resolveAcceptedRecipients(result: unknown) {
    if (
      result &&
      typeof result === 'object' &&
      'accepted' in result &&
      Array.isArray(result.accepted)
    ) {
      return result.accepted.map((recipient) => String(recipient));
    }

    return [];
  }
}
