-- CreateEnum
CREATE TYPE "VariantPricingStatus" AS ENUM ('HAS_PRICE', 'CONTACT_FOR_PRICE');

-- AlterTable
ALTER TABLE "product_variants"
ADD COLUMN "pricing_status" "VariantPricingStatus" NOT NULL DEFAULT 'HAS_PRICE';
