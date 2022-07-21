/*
  Warnings:

  - Added the required column `mainWaitlist` to the `WaitlistStatistics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WaitlistStatistics" ADD COLUMN     "mainWaitlist" BOOLEAN NOT NULL;
