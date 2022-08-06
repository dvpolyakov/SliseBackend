-- CreateTable
CREATE TABLE "WhitelistMemberInfo" (
    "twitter" TEXT,
    "twitterFollowers" INTEGER,
    "discord" TEXT,
    "whitelistMemberId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistMemberInfo_whitelistMemberId_key" ON "WhitelistMemberInfo"("whitelistMemberId");

-- AddForeignKey
ALTER TABLE "WhitelistMemberInfo" ADD CONSTRAINT "WhitelistMemberInfo_whitelistMemberId_fkey" FOREIGN KEY ("whitelistMemberId") REFERENCES "WhitelistMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
