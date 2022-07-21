-- CreateTable
CREATE TABLE "TargetingHolders" (
    "id" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "waitlistId" TEXT NOT NULL,
    "vector" INTEGER NOT NULL,

    CONSTRAINT "TargetingHolders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TargetingHolders" ADD CONSTRAINT "TargetingHolders_waitlistId_fkey" FOREIGN KEY ("waitlistId") REFERENCES "Waitlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingHolders" ADD CONSTRAINT "TargetingHolders_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "TokenHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
