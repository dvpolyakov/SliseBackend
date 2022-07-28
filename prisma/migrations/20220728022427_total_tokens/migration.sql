/*
  Warnings:

  - Added the required column `totalTokens` to the `WhitelistMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WhitelistMember" ADD COLUMN     "totalTokens" INTEGER NOT NULL;
