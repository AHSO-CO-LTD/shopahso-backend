DO $$ BEGIN
  CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VariantPricingStatus" AS ENUM ('HAS_PRICE', 'CONTACT_FOR_PRICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "sale_price" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "discount_percent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "pricing_status" "VariantPricingStatus" NOT NULL DEFAULT 'HAS_PRICE',
  ADD COLUMN IF NOT EXISTS "origin_country_code" TEXT,
  ADD COLUMN IF NOT EXISTS "tax_percent" DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS "idx_variants_origin_country_code"
  ON "product_variants"("origin_country_code");

UPDATE "product_variants"
SET "cost_price" = "price"
WHERE "cost_price" IS NULL;

ALTER TABLE "product_variants"
  ALTER COLUMN "cost_price" SET NOT NULL;
