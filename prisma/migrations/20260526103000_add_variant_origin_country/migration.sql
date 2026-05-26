-- AlterTable
ALTER TABLE "product_variants"
ADD COLUMN "origin_country_code" TEXT;

-- CreateIndex
CREATE INDEX "idx_variants_origin_country_code" ON "product_variants"("origin_country_code");
