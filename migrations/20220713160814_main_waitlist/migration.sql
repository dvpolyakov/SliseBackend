/*
  Warnings:

  - You are about to drop the column `mainWaitlist` on the `WaitlistStatistics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Waitlist" ADD COLUMN     "mainWaitlist" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "WaitlistStatistics" DROP COLUMN "mainWaitlist";
