CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "ward_code" TEXT NOT NULL,
    "ward_name" TEXT NOT NULL,
    "street_address" TEXT NOT NULL,
    "note" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_user_addresses_user_id_status" ON "user_addresses"("user_id", "status");
CREATE INDEX "idx_user_addresses_province_ward" ON "user_addresses"("province_code", "ward_code");
CREATE UNIQUE INDEX "uq_user_addresses_one_default_per_user" ON "user_addresses"("user_id") WHERE "status" = true;

ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
