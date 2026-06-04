-- AlterTable
ALTER TABLE "brands"
ADD COLUMN IF NOT EXISTS "banner_url" TEXT,
ADD COLUMN IF NOT EXISTS "banner_public_id" TEXT;
