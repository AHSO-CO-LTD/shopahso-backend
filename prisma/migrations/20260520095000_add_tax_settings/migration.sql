CREATE TYPE "TaxScope" AS ENUM ('GLOBAL', 'CATEGORY', 'PRODUCT', 'VARIANT');

CREATE TABLE "tax_settings" (
    "id" TEXT NOT NULL,
    "scope" "TaxScope" NOT NULL,
    "target_id" TEXT,
    "target_key" TEXT NOT NULL,
    "tax_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_tax_settings_scope_target_key" ON "tax_settings"("scope", "target_key");
CREATE INDEX "idx_tax_settings_scope" ON "tax_settings"("scope");
