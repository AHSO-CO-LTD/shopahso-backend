CREATE TABLE "mail_settings" (
    "id" TEXT NOT NULL,
    "admin_order_recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notify_registration_customer" BOOLEAN NOT NULL DEFAULT true,
    "notify_order_created_customer" BOOLEAN NOT NULL DEFAULT true,
    "notify_order_status_customer" BOOLEAN NOT NULL DEFAULT true,
    "notify_order_created_admin" BOOLEAN NOT NULL DEFAULT true,
    "notify_order_completed_admin" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_settings_pkey" PRIMARY KEY ("id")
);
