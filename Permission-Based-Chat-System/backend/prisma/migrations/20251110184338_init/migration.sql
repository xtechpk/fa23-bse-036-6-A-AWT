/*
  Warnings:

  - You are about to alter the column `costValue` on the `InventoryWaste` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE "InventoryWaste" ADD COLUMN     "location" TEXT,
ADD COLUMN     "rank" TEXT,
ALTER COLUMN "costValue" SET DATA TYPE DECIMAL(12,2);
