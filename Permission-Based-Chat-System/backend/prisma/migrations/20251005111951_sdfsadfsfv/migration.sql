/*
  Warnings:

  - Added the required column `medicalStoreId` to the `Batch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "medicalStoreId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Batch_medicalStoreId_idx" ON "Batch"("medicalStoreId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "MedicalStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
