-- DropIndex
DROP INDEX IF EXISTS "SocialLink_platform_key";

-- AlterTable
ALTER TABLE "SocialLink" DROP COLUMN "platform";

-- DropEnum
DROP TYPE "SocialPlatform";
