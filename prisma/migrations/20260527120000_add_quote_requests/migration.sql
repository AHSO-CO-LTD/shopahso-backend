-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('PENDING', 'QUOTED', 'CANCELLED', 'CLOSED');

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" TEXT NOT NULL,
    "request_code" TEXT NOT NULL,
    "request_group_code" TEXT NOT NULL,
    "user_id" TEXT,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "customer_note" TEXT,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'PENDING',
    "staff_note" TEXT,
    "claimed_by_staff_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "quoted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_request_code_key" ON "quote_requests"("request_code");

-- CreateIndex
CREATE INDEX "idx_quote_requests_user_created_at" ON "quote_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_quote_requests_email_status_created" ON "quote_requests"("customer_email", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_quote_requests_phone_status_created" ON "quote_requests"("customer_phone", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_quote_requests_group_created" ON "quote_requests"("request_group_code", "created_at");

-- CreateIndex
CREATE INDEX "idx_quote_requests_status_created" ON "quote_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_quote_requests_staff_status" ON "quote_requests"("claimed_by_staff_id", "status");

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_claimed_by_staff_id_fkey" FOREIGN KEY ("claimed_by_staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
