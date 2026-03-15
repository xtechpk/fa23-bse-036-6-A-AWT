/*
  Warnings:

  - A unique constraint covering the columns `[medicalStoreId,medicineId]` on the table `MedicalStoreMedicine` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MedicalStoreMedicine_medicalStoreId_medicineId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "MedicalStoreMedicine_medicalStoreId_medicineId_key" ON "MedicalStoreMedicine"("medicalStoreId", "medicineId");
