-- DropForeignKey
ALTER TABLE "MedicalStore" DROP CONSTRAINT "MedicalStore_ownerId_fkey";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "MedicalStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalStore" ADD CONSTRAINT "MedicalStore_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
