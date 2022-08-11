-- CreateIndex
CREATE INDEX "idx_token_whitelistmember_id" ON "Token"("whitelistMemberId");

-- CreateIndex
CREATE INDEX "idx_whitelistmember_whitelist_id" ON "WhitelistMember"("whitelistId");
