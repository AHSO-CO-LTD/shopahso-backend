import { Injectable } from '@nestjs/common';

@Injectable()
export class MailConfigService {
  get host() {
    return process.env.MAIL_HOST?.trim();
  }

  get port() {
    return Number(process.env.MAIL_PORT ?? 587);
  }

  get secure() {
    return process.env.MAIL_SECURE === 'true';
  }

  get user() {
    return process.env.MAIL_USER?.trim();
  }

  get pass() {
    return process.env.MAIL_PASS;
  }

  get fromName() {
    return process.env.MAIL_FROM_NAME?.trim() || 'Shop AHSO';
  }

  get fromEmail() {
    return process.env.MAIL_FROM_EMAIL?.trim() || this.user;
  }

  get shopUrl() {
    return this.normalizeUrl(process.env.SHOP_URL) || 'http://localhost:3000';
  }

  get backofficeOrderUrl() {
    return (
      this.normalizeUrl(process.env.BACKOFFICE_ORDER_URL) ||
      `${this.shopUrl}/backoffice/orders`
    );
  }

  get backofficeQuoteRequestUrl() {
    return (
      this.normalizeUrl(process.env.BACKOFFICE_QUOTE_REQUEST_URL) ||
      `${this.shopUrl}/nhan-vien/bao-gia`
    );
  }

  get enabled() {
    return Boolean(this.host && this.user && this.pass && this.fromEmail);
  }

  private normalizeUrl(value?: string) {
    return value?.trim().replace(/\/$/, '');
  }
}
