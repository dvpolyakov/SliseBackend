/*
  Warnings:

  - You are about to drop the `TokenItem` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `items` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TokenItem" DROP CONSTRAINT "TokenItem_originalTokenId_fkey";

-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "items" JSONB NOT NULL;

-- DropTable
DROP TABLE "TokenItem";
