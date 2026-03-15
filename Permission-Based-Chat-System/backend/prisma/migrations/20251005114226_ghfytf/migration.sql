/*
  Warnings:

  - Added the required column `medicalStoreId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "medicalStoreId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Order_medicalStoreId_idx" ON "Order"("medicalStoreId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "MedicalStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
