/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - Made the column `address` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Whitelist" DROP CONSTRAINT "Whitelist_ownerId_fkey";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ALTER COLUMN "address" SET NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("address");

-- AddForeignKey
ALTER TABLE "Whitelist" ADD CONSTRAINT "Whitelist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
