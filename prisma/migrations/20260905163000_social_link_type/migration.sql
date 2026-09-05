-- CreateEnum
CREATE TYPE "SocialMediaType" AS ENUM ('image', 'video');

-- AlterTable
ALTER TABLE "SocialLink" DROP COLUMN "icon";
ALTER TABLE "SocialLink" ADD COLUMN "type" "SocialMediaType" NOT NULL DEFAULT 'image';

-- Drop default after backfill
ALTER TABLE "SocialLink" ALTER COLUMN "type" DROP DEFAULT;
