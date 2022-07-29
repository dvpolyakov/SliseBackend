-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('ERC20', 'ERC223', 'ERC721', 'ERC827', 'ERC1155', 'UNKOWN');

-- CreateEnum
CREATE TYPE "ChainType" AS ENUM ('ETHEREUM', 'POLYGON', 'SOLANA', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Whitelist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT,
    "twitter" TEXT,
    "twitterFollowers" INTEGER,
    "discord" TEXT,
    "discordMembers" INTEGER,
    "size" INTEGER NOT NULL,
    "chainType" "ChainType" NOT NULL DEFAULT E'ETHEREUM',

    CONSTRAINT "Whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistMember" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "usdBalance" DOUBLE PRECISION NOT NULL,
    "ethBalance" DOUBLE PRECISION NOT NULL,
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whitelistId" TEXT NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "tokenProcessed" BOOLEAN NOT NULL DEFAULT true,
    "tokenProcessedAttemps" INTEGER NOT NULL,

    CONSTRAINT "WhitelistMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tokenType" "TokenType" NOT NULL DEFAULT E'UNKOWN',
    "nftVersion" TEXT,
    "nftDescription" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "whitelistMemberId" TEXT NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WhitelistMember" ADD CONSTRAINT "WhitelistMember_whitelistId_fkey" FOREIGN KEY ("whitelistId") REFERENCES "Whitelist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_whitelistMemberId_fkey" FOREIGN KEY ("whitelistMemberId") REFERENCES "WhitelistMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;