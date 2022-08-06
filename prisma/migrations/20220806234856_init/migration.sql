-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('ERC20', 'ERC223', 'ERC721', 'ERC827', 'ERC1155', 'UNKOWN');

-- CreateEnum
CREATE TYPE "ChainType" AS ENUM ('ETHEREUM', 'POLYGON', 'SOLANA', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Whitelist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT,
    "size" INTEGER NOT NULL,
    "chainType" "ChainType" NOT NULL DEFAULT E'ETHEREUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "Whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistInfo" (
    "id" TEXT NOT NULL,
    "logo" TEXT,
    "urlSlug" TEXT,
    "mintPrice" DOUBLE PRECISION,
    "mintDate" TIMESTAMP(3),
    "registrationEndDate" TIMESTAMP(3),
    "url" TEXT,
    "twitter" TEXT,
    "twitterFollowers" INTEGER,
    "discord" TEXT,
    "discordMembers" INTEGER,
    "description" TEXT,
    "whitelistId" TEXT NOT NULL,

    CONSTRAINT "WhitelistInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationSettings" (
    "id" TEXT NOT NULL,
    "registrationActive" BOOLEAN NOT NULL,
    "twitterVerification" BOOLEAN NOT NULL,
    "minTwitterFollowers" INTEGER NOT NULL,
    "discordVerification" BOOLEAN NOT NULL,
    "minWalletBalance" INTEGER NOT NULL,
    "totalSize" INTEGER NOT NULL,
    "whitelistId" TEXT NOT NULL,

    CONSTRAINT "RegistrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistLink" (
    "link" TEXT NOT NULL,
    "whitelistId" TEXT NOT NULL,

    CONSTRAINT "WhitelistLink_pkey" PRIMARY KEY ("link")
);

-- CreateTable
CREATE TABLE "WhitelistMember" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whitelistId" TEXT NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "tokenProcessed" BOOLEAN NOT NULL DEFAULT true,
    "tokenProcessedAttemps" INTEGER NOT NULL,

    CONSTRAINT "WhitelistMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistMemberInfo" (
    "twitter" TEXT,
    "twitterFollowers" INTEGER,
    "discord" TEXT,
    "whitelistMemberId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "address" TEXT NOT NULL,
    "chainType" "ChainType" NOT NULL DEFAULT E'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "AccountBalance" (
    "id" TEXT NOT NULL,
    "whitelistMemberId" TEXT NOT NULL,
    "tokenBalance" DOUBLE PRECISION NOT NULL,
    "usdBalance" DOUBLE PRECISION NOT NULL,
    "chainType" "ChainType" NOT NULL DEFAULT E'UNKNOWN',

    CONSTRAINT "AccountBalance_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "CollectionInfo" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "floor_price" INTEGER,
    "total_supply" INTEGER,
    "mint_price" INTEGER,
    "num_owners" INTEGER,
    "one_day_volume" INTEGER,
    "one_day_change" INTEGER,
    "one_day_sales" INTEGER,
    "one_day_average_price" INTEGER,
    "seven_day_volume" INTEGER,
    "seven_day_change" INTEGER,
    "seven_day_sales" INTEGER,
    "seven_day_average_price" INTEGER,
    "thirty_day_volume" INTEGER,
    "thirty_day_change" INTEGER,
    "thirty_day_sales" INTEGER,
    "thirty_day_average_price" INTEGER,
    "total_volume" INTEGER,
    "total_sales" INTEGER,
    "total_minted" INTEGER,
    "average_price" INTEGER,
    "market_cap" INTEGER,
    "floor_price_historic_one_day" INTEGER,
    "floor_price_historic_seven_day" INTEGER,
    "floor_price_historic_thirty_day" INTEGER,
    "updated_date" TEXT,

    CONSTRAINT "CollectionInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistInfo_whitelistId_key" ON "WhitelistInfo"("whitelistId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationSettings_whitelistId_key" ON "RegistrationSettings"("whitelistId");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistLink_whitelistId_key" ON "WhitelistLink"("whitelistId");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistMemberInfo_whitelistMemberId_key" ON "WhitelistMemberInfo"("whitelistMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionInfo_tokenId_key" ON "CollectionInfo"("tokenId");

-- AddForeignKey
ALTER TABLE "Whitelist" ADD CONSTRAINT "Whitelist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistInfo" ADD CONSTRAINT "WhitelistInfo_whitelistId_fkey" FOREIGN KEY ("whitelistId") REFERENCES "Whitelist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationSettings" ADD CONSTRAINT "RegistrationSettings_whitelistId_fkey" FOREIGN KEY ("whitelistId") REFERENCES "Whitelist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistLink" ADD CONSTRAINT "WhitelistLink_whitelistId_fkey" FOREIGN KEY ("whitelistId") REFERENCES "Whitelist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistMember" ADD CONSTRAINT "WhitelistMember_whitelistId_fkey" FOREIGN KEY ("whitelistId") REFERENCES "Whitelist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistMemberInfo" ADD CONSTRAINT "WhitelistMemberInfo_whitelistMemberId_fkey" FOREIGN KEY ("whitelistMemberId") REFERENCES "WhitelistMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBalance" ADD CONSTRAINT "AccountBalance_whitelistMemberId_fkey" FOREIGN KEY ("whitelistMemberId") REFERENCES "WhitelistMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_whitelistMemberId_fkey" FOREIGN KEY ("whitelistMemberId") REFERENCES "WhitelistMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionInfo" ADD CONSTRAINT "CollectionInfo_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
