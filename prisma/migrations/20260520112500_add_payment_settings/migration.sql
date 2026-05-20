CREATE TYPE "PaymentProvider" AS ENUM ('VIETQR');

CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'VIETQR',
    "bank_code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "qr_template" TEXT NOT NULL DEFAULT 'compact2',
    "transfer_content_template" TEXT NOT NULL DEFAULT 'AHSO {orderCode}',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_payment_settings_active" ON "payment_settings"("active");
CREATE UNIQUE INDEX "uq_payment_settings_one_active" ON "payment_settings"("active") WHERE "active" = true;
