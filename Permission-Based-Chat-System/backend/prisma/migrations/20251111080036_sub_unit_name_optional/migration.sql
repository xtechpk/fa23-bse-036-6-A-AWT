/*
  Warnings:

  - You are about to drop the column `location` on the `InventoryWaste` table. All the data in the column will be lost.
  - You are about to drop the column `rank` on the `InventoryWaste` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InventoryWaste" DROP COLUMN "location",
DROP COLUMN "rank";

-- AlterTable
ALTER TABLE "SubUnit" ALTER COLUMN "name" DROP NOT NULL;
