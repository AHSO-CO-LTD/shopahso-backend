import { Injectable } from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  QuoteRequestStatus,
} from '@prisma/client';

type TemplateResult = {
  subject: string;
  html: string;
  text: string;
};

type OrderTemplateItem = {
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  totalAmount: { toString(): string };
};

type OrderTemplateInput = {
  id: string;
  orderCode: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  grandTotalAmount: { toString(): string };
  paymentQrUrl: string | null;
  paymentBankName: string | null;
  paymentBankAccountNumber: string | null;
  paymentBankAccountName: string | null;
  paymentTransferContent: string | null;
  paymentRejectReason: string | null;
  items: OrderTemplateItem[];
};

type QuoteRequestTemplateInput = {
  requestCode: string;
  requestGroupCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
  status: QuoteRequestStatus;
  staffNote: string | null;
  product: {
    name: string;
    slug: string;
  };
  variant: {
    name: string;
    sku: string;
  };
};

@Injectable()
export class MailTemplatesService {
  welcome(input: { fullName: string | null; email: string; shopUrl: string }) {
    const name = input.fullName || input.email;
    const subject = 'Chào mừng bạn đến với Shop AHSO';
    const intro =
      'Cảm ơn bạn đã tạo tài khoản tại Shop AHSO. Tài khoản của bạn đã sẵn sàng để theo dõi đơn hàng, lưu thông tin giao hàng và mua sắm thuận tiện hơn.';
    const sections = [
      this.noticeBox(
        'Tài khoản đã được tạo thành công',
        'Từ bây giờ bạn có thể đăng nhập Shop AHSO để theo dõi đơn hàng, lưu thông tin giao hàng và mua sắm thuận tiện hơn.',
      ),
      this.infoList([
        ['Email đăng ký', input.email],
        ['Trang mua hàng', input.shopUrl],
      ]),
      this.button('Đăng nhập Shop AHSO', input.shopUrl),
    ];

    return this.layout({
      subject,
      greetingName: name,
      intro,
      sections,
      textLines: [
        `Xin chào ${name},`,
        intro,
        `Email đăng ký: ${input.email}`,
        `Đăng nhập tại: ${input.shopUrl}`,
      ],
    });
  }

  orderCreatedForCustomer(input: {
    order: OrderTemplateInput;
    lookupUrl: string;
  }) {
    const subject = `Shop AHSO đã nhận đơn hàng ${input.order.orderCode}`;
    const intro = `Đơn hàng ${input.order.orderCode} đã được tạo thành công. Shop AHSO sẽ kiểm tra thông tin và xác nhận đơn hàng trong thời gian sớm nhất.`;
    const sections = [
      this.noticeBox(
        'Shop AHSO đã nhận đơn hàng của bạn',
        `Đơn hàng ${input.order.orderCode} đã được ghi nhận trên hệ thống. Nhân viên Shop AHSO sẽ kiểm tra thông tin thanh toán và xác nhận đơn trong thời gian sớm nhất.`,
      ),
      this.infoList([
        ['Mã đơn hàng', input.order.orderCode],
        ['Tổng thanh toán', this.formatMoney(input.order.grandTotalAmount)],
        ['Trạng thái', this.orderStatusLabel(input.order.status)],
      ]),
      this.orderItemsHtml(input.order.items),
      this.paymentHtml(input.order),
      this.button('Tra cứu đơn hàng', input.lookupUrl),
    ];

    return this.layout({
      subject,
      greetingName:
        input.order.customerName || input.order.customerEmail || 'quý khách',
      intro,
      sections,
      textLines: [
        `Xin chào ${input.order.customerName || input.order.customerEmail || 'quý khách'},`,
        intro,
        `Mã đơn hàng: ${input.order.orderCode}`,
        `Tổng thanh toán: ${this.formatMoney(input.order.grandTotalAmount)}`,
        `Tra cứu đơn hàng: ${input.lookupUrl}`,
        ...this.paymentLines(input.order),
      ],
    });
  }

  orderStatusForCustomer(input: {
    order: OrderTemplateInput;
    lookupUrl: string;
  }) {
    const statusLabel = this.orderStatusLabel(input.order.status);
    const subject = `Cập nhật đơn hàng ${input.order.orderCode}: ${statusLabel}`;
    const statusNotice = this.statusMessage(input.order);
    const intro = `Shop AHSO gửi bạn thông tin cập nhật mới nhất cho đơn hàng ${input.order.orderCode}.`;
    const sections = [
      this.noticeBox(
        'Đơn hàng vừa có cập nhật',
        `Shop AHSO vừa cập nhật tiến trình xử lý cho đơn hàng ${input.order.orderCode}. Bạn có thể xem chi tiết bên dưới hoặc tra cứu đơn hàng để theo dõi trạng thái mới nhất.`,
      ),
      this.infoList([
        ['Mã đơn hàng', input.order.orderCode],
        ['Thanh toán', this.paymentStatusLabel(input.order.paymentStatus)],
        ['Trạng thái đơn hàng', statusLabel],
      ]),
      this.noticeBox('Lưu ý', statusNotice),
      this.button('Tra cứu đơn hàng', input.lookupUrl),
    ];

    return this.layout({
      subject,
      greetingName:
        input.order.customerName || input.order.customerEmail || 'quý khách',
      intro,
      sections,
      textLines: [
        `Xin chào ${input.order.customerName || input.order.customerEmail || 'quý khách'},`,
        `Đơn hàng ${input.order.orderCode}: ${statusLabel}`,
        statusNotice,
        `Tra cứu đơn hàng: ${input.lookupUrl}`,
      ],
    });
  }

  orderCreatedForAdmin(input: {
    order: OrderTemplateInput;
    backofficeUrl: string;
  }) {
    const subject = `Đơn hàng mới ${input.order.orderCode}`;
    const intro = `Shop AHSO vừa nhận một đơn hàng mới. Vui lòng kiểm tra và xử lý trong backoffice.`;
    const sections = [
      this.noticeBox(
        'Có đơn hàng mới cần kiểm tra',
        `Hệ thống vừa ghi nhận đơn hàng ${input.order.orderCode}. Vui lòng mở backoffice để kiểm tra thông tin khách hàng, sản phẩm và trạng thái thanh toán trước khi xử lý tiếp.`,
      ),
      this.infoList([
        ['Mã đơn hàng', input.order.orderCode],
        ['Khách hàng', input.order.customerName || 'Chưa có tên'],
        ['Email', input.order.customerEmail || 'Không có'],
        ['Số điện thoại', input.order.customerPhone || 'Không có'],
        ['Tổng thanh toán', this.formatMoney(input.order.grandTotalAmount)],
      ]),
      this.orderItemsHtml(input.order.items),
      this.button('Mở đơn hàng trong backoffice', input.backofficeUrl),
    ];

    return this.layout({
      subject,
      greetingName: 'đội ngũ Shop AHSO',
      intro,
      sections,
      textLines: [
        intro,
        `Mã đơn hàng: ${input.order.orderCode}`,
        `Khách hàng: ${input.order.customerName || 'Chưa có tên'}`,
        `Email: ${input.order.customerEmail || 'Không có'}`,
        `Số điện thoại: ${input.order.customerPhone || 'Không có'}`,
        `Tổng thanh toán: ${this.formatMoney(input.order.grandTotalAmount)}`,
        `Backoffice: ${input.backofficeUrl}`,
      ],
    });
  }

  orderCompletedForAdmin(input: {
    order: OrderTemplateInput;
    backofficeUrl: string;
  }) {
    const subject = `Đơn hàng ${input.order.orderCode} đã hoàn thành`;
    const intro = `Đơn hàng ${input.order.orderCode} đã được xác nhận hoàn thành.`;
    const sections = [
      this.noticeBox(
        'Đơn hàng đã hoàn thành',
        `Đơn hàng ${input.order.orderCode} đã được cập nhật hoàn thành trên hệ thống. Bạn có thể mở backoffice để kiểm tra lại thông tin đơn nếu cần đối soát.`,
      ),
      this.infoList([
        ['Mã đơn hàng', input.order.orderCode],
        ['Khách hàng', input.order.customerName || 'Chưa có tên'],
        ['Tổng thanh toán', this.formatMoney(input.order.grandTotalAmount)],
      ]),
      this.button('Xem đơn hàng', input.backofficeUrl),
    ];

    return this.layout({
      subject,
      greetingName: 'đội ngũ Shop AHSO',
      intro,
      sections,
      textLines: [
        intro,
        `Khách hàng: ${input.order.customerName || 'Chưa có tên'}`,
        `Tổng thanh toán: ${this.formatMoney(input.order.grandTotalAmount)}`,
        `Backoffice: ${input.backofficeUrl}`,
      ],
    });
  }

  quoteRequestCreatedForCustomer(input: {
    requests: QuoteRequestTemplateInput[];
  }) {
    const firstRequest = input.requests[0];
    const subject = `Shop AHSO đã nhận yêu cầu báo giá ${firstRequest.requestGroupCode}`;
    const intro =
      'Shop AHSO đã ghi nhận yêu cầu báo giá của bạn. Nhân viên phụ trách sẽ kiểm tra thông tin và liên hệ trực tiếp trong thời gian sớm nhất.';
    const sections = [
      this.noticeBox('Yêu cầu báo giá đã được ghi nhận', intro),
      this.infoList([
        ['Mã nhóm yêu cầu', firstRequest.requestGroupCode],
        ['Khách hàng', firstRequest.customerName],
        ['Email', firstRequest.customerEmail],
        ['Số điện thoại', firstRequest.customerPhone],
      ]),
      this.quoteItemsHtml(input.requests),
    ];

    return this.layout({
      subject,
      greetingName: firstRequest.customerName || firstRequest.customerEmail,
      intro,
      sections,
      textLines: [
        `Xin chào ${firstRequest.customerName || firstRequest.customerEmail},`,
        intro,
        `Mã nhóm yêu cầu: ${firstRequest.requestGroupCode}`,
        ...input.requests.map(
          (request) =>
            `${request.requestCode}: ${request.product.name} - ${request.variant.name} (${request.variant.sku})`,
        ),
      ],
    });
  }

  quoteRequestCreatedForAdmin(input: {
    requests: QuoteRequestTemplateInput[];
    backofficeUrl: string;
  }) {
    const firstRequest = input.requests[0];
    const subject = `Yêu cầu báo giá mới ${firstRequest.requestGroupCode}`;
    const intro =
      'Shop AHSO vừa nhận yêu cầu báo giá mới. Vui lòng mở backoffice để kiểm tra và nhận xử lý.';
    const sections = [
      this.noticeBox('Có yêu cầu báo giá mới cần xử lý', intro),
      this.infoList([
        ['Mã nhóm yêu cầu', firstRequest.requestGroupCode],
        ['Khách hàng', firstRequest.customerName],
        ['Email', firstRequest.customerEmail],
        ['Số điện thoại', firstRequest.customerPhone],
      ]),
      this.quoteItemsHtml(input.requests),
      this.button('Mở yêu cầu báo giá trong backoffice', input.backofficeUrl),
    ];

    return this.layout({
      subject,
      greetingName: 'đội ngũ Shop AHSO',
      intro,
      sections,
      textLines: [
        intro,
        `Mã nhóm yêu cầu: ${firstRequest.requestGroupCode}`,
        `Khách hàng: ${firstRequest.customerName}`,
        `Email: ${firstRequest.customerEmail}`,
        `Số điện thoại: ${firstRequest.customerPhone}`,
        `Backoffice: ${input.backofficeUrl}`,
      ],
    });
  }

  quoteRequestStatusForCustomer(input: { request: QuoteRequestTemplateInput }) {
    const statusLabel = this.quoteRequestStatusLabel(input.request.status);
    const subject = `Cập nhật yêu cầu báo giá ${input.request.requestCode}: ${statusLabel}`;
    const intro = `Yêu cầu báo giá ${input.request.requestCode} vừa được cập nhật trạng thái: ${statusLabel}.`;
    const sections = [
      this.noticeBox('Yêu cầu báo giá vừa có cập nhật', intro),
      this.infoList([
        ['Mã yêu cầu', input.request.requestCode],
        ['Sản phẩm', input.request.product.name],
        ['Phiên bản', input.request.variant.name],
        ['SKU', input.request.variant.sku],
        ['Trạng thái', statusLabel],
        ['Ghi chú', input.request.staffNote || 'Không có'],
      ]),
    ];

    return this.layout({
      subject,
      greetingName: input.request.customerName || input.request.customerEmail,
      intro,
      sections,
      textLines: [
        `Xin chào ${input.request.customerName || input.request.customerEmail},`,
        intro,
        `Sản phẩm: ${input.request.product.name}`,
        `Phiên bản: ${input.request.variant.name}`,
        `Trạng thái: ${statusLabel}`,
        `Ghi chú: ${input.request.staffNote || 'Không có'}`,
      ],
    });
  }

  test(input: { email: string }) {
    const subject = 'Kiểm tra cấu hình email Shop AHSO';
    const intro =
      'Email kiểm tra đã được gửi thành công. Nếu bạn nhận được email này, cấu hình SMTP đang hoạt động.';

    return this.layout({
      subject,
      greetingName: input.email,
      intro,
      sections: [
        this.noticeBox(
          'Kiểm tra gửi email thành công',
          'Hệ thống Shop AHSO đã gửi email kiểm tra bằng cấu hình SMTP hiện tại. Nếu email này hiển thị đúng, cấu hình gửi mail đang hoạt động.',
        ),
        this.infoList([
          ['Email nhận', input.email],
          ['Trạng thái', 'SMTP hoạt động'],
        ]),
      ],
      textLines: [`Xin chào ${input.email},`, intro],
    });
  }

  private layout(input: {
    subject: string;
    greetingName: string;
    intro: string;
    sections: string[];
    textLines: string[];
  }): TemplateResult {
    const html = `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${this.escape(input.subject)}</title>
        </head>
        <body style="margin:0;padding:0;background:#f3f4f6;color:#111827;font-family:Arial,Helvetica,sans-serif">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                  <tr>
                    <td style="background:#111827;color:#ffffff;padding:22px 28px">
                      <div style="font-size:20px;font-weight:700;line-height:1.2">Shop AHSO</div>
                      <div style="font-size:13px;color:#d1d5db;margin-top:6px">Thông báo tự động từ hệ thống</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:28px">
                      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#111827">${this.escape(input.subject)}</h1>
                      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">Xin chào ${this.escape(input.greetingName)},</p>
                      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151">${this.escape(input.intro)}</p>
                      ${input.sections.join('')}
                      <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#4b5563">
                        Trân trọng,<br>
                        <strong>Shop AHSO</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 28px;color:#6b7280;font-size:12px;line-height:1.6">
                      Đây là email tự động, vui lòng không trả lời trực tiếp email này. Nếu bạn cần hỗ trợ, hãy liên hệ Shop AHSO qua kênh chăm sóc khách hàng chính thức.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    return {
      subject: input.subject,
      html,
      text: input.textLines.join('\n'),
    };
  }

  private infoList(items: Array<[string, string]>) {
    const rows = items
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:38%;font-size:14px">${this.escape(label)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600">${this.escape(value)}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;margin:18px 0;overflow:hidden">
        ${rows}
      </table>
    `;
  }

  private button(label: string, url: string) {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0">
        <tr>
          <td>
            <a href="${this.escapeAttribute(url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:6px">
              ${this.escape(label)}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  private noticeBox(title: string, message: string) {
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #111827;border-radius:6px;margin:18px 0">
        <tr>
          <td style="padding:14px 16px">
            <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px">${this.escape(title)}</div>
            <div style="font-size:14px;line-height:1.7;color:#374151">${this.escape(message)}</div>
          </td>
        </tr>
      </table>
    `;
  }

  private orderItemsHtml(items: OrderTemplateItem[]) {
    if (items.length === 0) {
      return '';
    }

    const rows = items
      .map(
        (item) => `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">
              <div style="font-size:14px;font-weight:700;color:#111827">${this.escape(item.productNameSnapshot)}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:4px">${this.escape(item.variantNameSnapshot)}</div>
            </td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px">${this.escape(item.skuSnapshot)}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px">${item.quantity}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;font-size:13px;font-weight:700">${this.formatMoney(item.totalAmount)}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <div style="margin:22px 0 8px;font-size:15px;font-weight:700;color:#111827">Sản phẩm trong đơn</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-collapse:collapse">
        <thead>
          <tr>
            <th align="left" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">Sản phẩm</th>
            <th align="left" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">SKU</th>
            <th align="right" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">SL</th>
            <th align="right" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">Thành tiền</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private quoteItemsHtml(items: QuoteRequestTemplateInput[]) {
    const rows = items
      .map(
        (item) => `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb">
              <div style="font-size:14px;font-weight:700;color:#111827">${this.escape(item.product.name)}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:4px">${this.escape(item.variant.name)}</div>
            </td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px">${this.escape(item.variant.sku)}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px">${item.quantity}</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:700">${this.escape(item.requestCode)}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <div style="margin:22px 0 8px;font-size:15px;font-weight:700;color:#111827">Sản phẩm cần báo giá</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-collapse:collapse">
        <thead>
          <tr>
            <th align="left" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">Sản phẩm</th>
            <th align="left" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">SKU</th>
            <th align="right" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">SL</th>
            <th align="left" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase">Mã yêu cầu</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private paymentHtml(order: OrderTemplateInput) {
    const rows: Array<[string, string]> = [];

    if (order.paymentBankName && order.paymentBankAccountNumber) {
      rows.push(['Ngân hàng', order.paymentBankName]);
      rows.push(['Số tài khoản', order.paymentBankAccountNumber]);
    }

    if (order.paymentBankAccountName) {
      rows.push(['Chủ tài khoản', order.paymentBankAccountName]);
    }

    if (order.paymentTransferContent) {
      rows.push(['Nội dung chuyển khoản', order.paymentTransferContent]);
    }

    if (rows.length === 0 && !order.paymentQrUrl) {
      return '';
    }

    return `
      <div style="margin:22px 0 8px;font-size:15px;font-weight:700;color:#111827">Thông tin thanh toán</div>
      ${rows.length > 0 ? this.infoList(rows) : ''}
      ${
        order.paymentQrUrl
          ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280">QR thanh toán: <a href="${this.escapeAttribute(order.paymentQrUrl)}" style="color:#111827">${this.escape(order.paymentQrUrl)}</a></p>`
          : ''
      }
    `;
  }

  private paymentLines(order: OrderTemplateInput) {
    const lines: string[] = [];

    if (order.paymentBankName && order.paymentBankAccountNumber) {
      lines.push(`Ngân hàng: ${order.paymentBankName}`);
      lines.push(`Số tài khoản: ${order.paymentBankAccountNumber}`);
    }

    if (order.paymentBankAccountName) {
      lines.push(`Chủ tài khoản: ${order.paymentBankAccountName}`);
    }

    if (order.paymentTransferContent) {
      lines.push(`Nội dung chuyển khoản: ${order.paymentTransferContent}`);
    }

    if (order.paymentQrUrl) {
      lines.push(`QR thanh toán: ${order.paymentQrUrl}`);
    }

    return lines;
  }

  private statusMessage(order: OrderTemplateInput) {
    if (order.status === OrderStatus.CONFIRMED) {
      if (order.paymentStatus === PaymentStatus.PAID) {
        return 'Đơn hàng của bạn đã được nhân viên hệ thống xác nhận chuyển khoản. Đơn hàng sẽ được chuẩn bị và gửi cho đơn vị vận chuyển trong thời gian sớm nhất.';
      }

      return 'Đơn hàng của bạn đã được xác nhận. Shop AHSO sẽ tiếp tục xử lý đơn hàng trong thời gian sớm nhất.';
    }

    if (order.status === OrderStatus.PROCESSING) {
      return 'Đơn hàng của bạn đang được Shop AHSO chuẩn bị. Chúng tôi sẽ cập nhật khi đơn hàng sẵn sàng bàn giao cho đơn vị vận chuyển.';
    }

    if (order.status === OrderStatus.READY_TO_SHIP) {
      return 'Đơn hàng của bạn đã được chuẩn bị xong và đang chờ bàn giao cho đơn vị vận chuyển.';
    }

    if (order.status === OrderStatus.SHIPPING) {
      return 'Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển. Vui lòng theo dõi trạng thái giao hàng trong thời gian tới.';
    }

    if (order.status === OrderStatus.COMPLETED) {
      return 'Đơn hàng của bạn đã hoàn thành. Cảm ơn bạn đã mua hàng tại Shop AHSO.';
    }

    if (order.status === OrderStatus.CANCELLED) {
      return `Đơn hàng của bạn đã bị hủy.${order.paymentRejectReason ? ` Lý do: ${order.paymentRejectReason}` : ''}`;
    }

    if (order.status === OrderStatus.REJECTED) {
      return `Đơn hàng của bạn không được xác nhận.${order.paymentRejectReason ? ` Lý do: ${order.paymentRejectReason}` : ''}`;
    }

    if (order.status === OrderStatus.PAYMENT_REVIEW) {
      return 'Shop AHSO đã nhận thông tin xác nhận chuyển khoản của bạn. Nhân viên hệ thống sẽ đối soát và cập nhật đơn hàng trong thời gian sớm nhất.';
    }

    if (order.status === OrderStatus.PENDING_PAYMENT) {
      return 'Đơn hàng của bạn đang chờ chuyển khoản. Vui lòng chuyển đúng số tiền và nội dung để Shop AHSO đối soát nhanh.';
    }

    return 'Shop AHSO sẽ tiếp tục cập nhật khi đơn hàng có thay đổi mới.';
  }

  private orderStatusLabel(status: OrderStatus) {
    const labels: Record<OrderStatus, string> = {
      PENDING_PAYMENT: 'Chờ thanh toán',
      PAYMENT_REVIEW: 'Đang kiểm tra thanh toán',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang xử lý',
      READY_TO_SHIP: 'Sẵn sàng giao hàng',
      SHIPPING: 'Đang vận chuyển',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Đã hủy',
      REJECTED: 'Không được xác nhận',
    };

    return labels[status];
  }

  private paymentStatusLabel(status: PaymentStatus) {
    const labels: Record<PaymentStatus, string> = {
      WAITING_CUSTOMER_TRANSFER: 'Chờ khách chuyển khoản',
      CUSTOMER_CONFIRMED: 'Khách đã xác nhận chuyển khoản',
      PAID: 'Đã thanh toán',
      REJECTED: 'Thanh toán bị từ chối',
      REFUNDED: 'Đã hoàn tiền',
    };

    return labels[status];
  }

  private quoteRequestStatusLabel(status: QuoteRequestStatus) {
    const labels: Record<QuoteRequestStatus, string> = {
      PENDING: 'Đang chờ',
      QUOTED: 'Đã nhận báo giá',
      CANCELLED: 'Đã hủy',
      CLOSED: 'Đã đóng',
    };

    return labels[status];
  }

  private formatMoney(value: { toString(): string }) {
    return `${Number(value.toString()).toLocaleString('vi-VN')} VND`;
  }

  private escape(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private escapeAttribute(value: string) {
    return this.escape(value).replaceAll('`', '&#096;');
  }
}
