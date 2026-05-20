ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "orders" ADD COLUMN "guest_token" TEXT;

CREATE INDEX "idx_orders_guest_token_created_at" ON "orders"("guest_token", "created_at");
CREATE INDEX "idx_orders_order_code_customer_email" ON "orders"("order_code", "customer_email");
