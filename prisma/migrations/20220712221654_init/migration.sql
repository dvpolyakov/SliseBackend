-- CreateEnum
CREATE TYPE "TransferProcessedStatus" AS ENUM ('STORED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('ERC20', 'ERC223', 'ERC721', 'ERC827', 'ERC1155', 'UNKOWN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SALE', 'MINT', 'BURN', 'TRANSFER', 'CANCEL_LIST');

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "network" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT,
    "symbol" TEXT,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistStatistics" (
    "id" TEXT NOT NULL,
    "totalBalance" INTEGER NOT NULL,
    "totalUsdBalance" INTEGER NOT NULL,
    "popularTokens" JSONB NOT NULL,

    CONSTRAINT "WaitlistStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenHolder" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "totalBalanceUsd" DOUBLE PRECISION NOT NULL,
    "totalBalanceTokens" INTEGER NOT NULL,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstTransactionDate" TIMESTAMP(3) NOT NULL,
    "ethBalance" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "processedTokens" BOOLEAN NOT NULL DEFAULT false,
    "processedBalance" BOOLEAN NOT NULL DEFAULT false,
    "processedTokensFail" BOOLEAN NOT NULL DEFAULT false,
    "processedBalanceFail" BOOLEAN NOT NULL DEFAULT false,
    "waitlistId" TEXT NOT NULL,

    CONSTRAINT "TokenHolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTransfer" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tokenId" BIGINT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractType" "TokenType" NOT NULL,
    "metadata" TEXT,
    "holderId" TEXT NOT NULL,
    "waitlistId" TEXT NOT NULL,
    "transferProcessedStatus" "TransferProcessedStatus" NOT NULL,

    CONSTRAINT "TokenTransfer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TokenHolder" ADD CONSTRAINT "TokenHolder_waitlistId_fkey" FOREIGN KEY ("waitlistId") REFERENCES "Waitlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
