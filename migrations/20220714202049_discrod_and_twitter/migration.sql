-- CreateEnum
CREATE TYPE "ChainType" AS ENUM ('ETHEREUM', 'POLYGON', 'SOLANA', 'UNKNOWN');

-- AlterTable
ALTER TABLE "TokenHolder" ADD COLUMN     "chainType" "ChainType" NOT NULL DEFAULT E'UNKNOWN';

-- AlterTable
ALTER TABLE "Waitlist" ADD COLUMN     "discord" TEXT,
ADD COLUMN     "discordMembers" INTEGER,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "twitterFollowers" INTEGER;
