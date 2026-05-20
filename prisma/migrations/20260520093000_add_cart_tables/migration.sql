CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "sale_price_snapshot" DECIMAL(12,2),
    "effective_price_snapshot" DECIMAL(12,2) NOT NULL,
    "image_url_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carts_guest_token_key" ON "carts"("guest_token");
CREATE UNIQUE INDEX "uq_carts_user_id" ON "carts"("user_id");
CREATE INDEX "idx_carts_user_id" ON "carts"("user_id");
CREATE UNIQUE INDEX "uq_cart_items_cart_id_variant_id" ON "cart_items"("cart_id", "variant_id");
CREATE INDEX "idx_cart_items_cart_id" ON "cart_items"("cart_id");
CREATE INDEX "idx_cart_items_product_id" ON "cart_items"("product_id");
CREATE INDEX "idx_cart_items_variant_id" ON "cart_items"("variant_id");

ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
