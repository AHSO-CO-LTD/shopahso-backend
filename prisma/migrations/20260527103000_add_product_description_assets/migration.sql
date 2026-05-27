-- CreateTable
CREATE TABLE "product_description_assets" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "alt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_description_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_description_assets_public_id_key" ON "product_description_assets"("public_id");

-- CreateIndex
CREATE INDEX "idx_product_description_assets_product_created" ON "product_description_assets"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "product_description_assets" ADD CONSTRAINT "product_description_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
