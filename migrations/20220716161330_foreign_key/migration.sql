-- AddForeignKey
ALTER TABLE "TokenTransfer" ADD CONSTRAINT "TokenTransfer_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "TokenHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
