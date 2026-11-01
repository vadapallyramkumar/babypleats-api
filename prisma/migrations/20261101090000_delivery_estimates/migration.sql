-- AlterTable
ALTER TABLE "Order" ADD COLUMN "estimatedDeliveryFrom" DATE;
ALTER TABLE "Order" ADD COLUMN "estimatedDeliveryTo" DATE;
ALTER TABLE "Order" ADD COLUMN "deliveryRegionName" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryEstimateCalculatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeliverySetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "preparationMinDays" INTEGER NOT NULL DEFAULT 2,
    "preparationMaxDays" INTEGER NOT NULL DEFAULT 3,
    "defaultTransitMinDays" INTEGER NOT NULL DEFAULT 3,
    "defaultTransitMaxDays" INTEGER NOT NULL DEFAULT 6,
    "cutoffTime" TEXT NOT NULL DEFAULT '14:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "workingDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5,6]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pincodePrefixes" JSONB NOT NULL,
    "transitMinDays" INTEGER NOT NULL,
    "transitMaxDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryHoliday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryHoliday_date_key" ON "DeliveryHoliday"("date");

-- CreateIndex
CREATE INDEX "DeliveryHoliday_date_idx" ON "DeliveryHoliday"("date");

-- Seed default settings row (idempotent)
INSERT INTO "DeliverySetting" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
