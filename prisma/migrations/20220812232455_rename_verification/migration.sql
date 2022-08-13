/*
  Warnings:

  - You are about to drop the column `balanceVerefication` on the `RegistrationSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RegistrationSettings" DROP COLUMN "balanceVerefication",
ADD COLUMN     "balanceVerification" BOOLEAN NOT NULL DEFAULT false;
