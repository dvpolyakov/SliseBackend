-- AlterTable
ALTER TABLE "TokenHolder" ALTER COLUMN "totalBalanceTokens" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Waitlist" ADD COLUMN     "size" INTEGER;
