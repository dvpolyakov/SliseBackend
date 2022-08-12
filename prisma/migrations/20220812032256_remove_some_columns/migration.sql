/*
  Warnings:

  - You are about to drop the column `registrationActive` on the `RegistrationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `totalSize` on the `RegistrationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `registrationEndDate` on the `WhitelistInfo` table. All the data in the column will be lost.
  - You are about to drop the column `urlSlug` on the `WhitelistInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RegistrationSettings" DROP COLUMN "registrationActive",
DROP COLUMN "totalSize";

-- AlterTable
ALTER TABLE "WhitelistInfo" DROP COLUMN "registrationEndDate",
DROP COLUMN "urlSlug",
ADD COLUMN     "registrationActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalSupply" INTEGER NOT NULL DEFAULT 1000;
