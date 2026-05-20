CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'REJECTED');
CREATE TYPE "PaymentStatus" AS ENUM ('WAITING_CUSTOMER_TRANSFER', 'CUSTOMER_CONFIRMED', 'PAID', 'REJECTED', 'REFUNDED');
CREATE TYPE "FulfillmentStatus" AS ENUM ('NOT_STARTED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPING', 'DELIVERED', 'FAILED', 'RETURNED');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER_QR');

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'WAITING_CUSTOMER_TRANSFER',
    "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "customer_name" TEXT,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "shipping_address_id" TEXT,
    "shipping_name" TEXT NOT NULL,
    "shipping_phone" TEXT,
    "shipping_province_code" TEXT NOT NULL,
    "shipping_province_name" TEXT NOT NULL,
    "shipping_ward_code" TEXT NOT NULL,
    "shipping_ward_name" TEXT NOT NULL,
    "shipping_street_address" TEXT NOT NULL,
    "shipping_note" TEXT,
    "invoice_requested" BOOLEAN NOT NULL DEFAULT false,
    "invoice_address_id" TEXT,
    "invoice_name" TEXT,
    "invoice_phone" TEXT,
    "invoice_company_name" TEXT,
    "invoice_tax_code" TEXT,
    "invoice_email" TEXT,
    "invoice_province_code" TEXT,
    "invoice_province_name" TEXT,
    "invoice_ward_code" TEXT,
    "invoice_ward_name" TEXT,
    "invoice_street_address" TEXT,
    "voucher_code" TEXT,
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "shipping_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grand_total_amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER_QR',
    "payment_provider" "PaymentProvider",
    "payment_qr_url" TEXT,
    "payment_bank_code" TEXT,
    "payment_bank_name" TEXT,
    "payment_bank_account_number" TEXT,
    "payment_bank_account_name" TEXT,
    "payment_transfer_content" TEXT,
    "payment_confirmed_by_user_at" TIMESTAMP(3),
    "payment_verified_at" TIMESTAMP(3),
    "payment_verified_by_staff_id" TEXT,
    "payment_reject_reason" TEXT,
    "customer_note" TEXT,
    "staff_note" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "image_url_snapshot" TEXT,
    "unit_snapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "sale_price_snapshot" DECIMAL(12,2),
    "effective_price_snapshot" DECIMAL(12,2) NOT NULL,
    "tax_percent_snapshot" DECIMAL(5,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");
CREATE INDEX "idx_orders_user_created_at" ON "orders"("user_id", "created_at");
CREATE INDEX "idx_orders_status_created_at" ON "orders"("status", "created_at");
CREATE INDEX "idx_orders_payment_status_created_at" ON "orders"("payment_status", "created_at");
CREATE INDEX "idx_order_items_order_id" ON "order_items"("order_id");
CREATE INDEX "idx_order_items_product_id" ON "order_items"("product_id");
CREATE INDEX "idx_order_items_variant_id" ON "order_items"("variant_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_address_id_fkey" FOREIGN KEY ("invoice_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_verified_by_staff_id_fkey" FOREIGN KEY ("payment_verified_by_staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
