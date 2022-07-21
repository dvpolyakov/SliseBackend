-- AlterTable
ALTER TABLE "TokenHolder" ADD COLUMN     "discord" TEXT,
ADD COLUMN     "discordMessages" INTEGER,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "twitterInteractions" INTEGER;

-- AlterTable
ALTER TABLE "TokenTransfer" ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "Waitlist" ADD COLUMN     "bluechipHolders" INTEGER,
ADD COLUMN     "bots" INTEGER,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "whales" INTEGER;
