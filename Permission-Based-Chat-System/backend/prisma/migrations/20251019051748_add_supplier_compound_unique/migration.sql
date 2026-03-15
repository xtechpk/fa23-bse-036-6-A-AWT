-- CreateEnum
CREATE TYPE "WasteReason" AS ENUM ('EXPIRED', 'DAMAGED', 'LOST', 'STOCK_ADJUSTMENT');

-- CreateTable
CREATE TABLE "InventoryWaste" (
    "id" SERIAL NOT NULL,
    "medicalStoreId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costValue" DOUBLE PRECISION NOT NULL,
    "reason" "WasteReason" NOT NULL,
    "description" TEXT,
    "returnToSupplier" BOOLEAN NOT NULL DEFAULT false,
    "returnedToSupplier" BOOLEAN NOT NULL DEFAULT false,
    "wasteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryWaste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryWaste_medicalStoreId_idx" ON "InventoryWaste"("medicalStoreId");

-- CreateIndex
CREATE INDEX "InventoryWaste_batchId_idx" ON "InventoryWaste"("batchId");

-- CreateIndex
CREATE INDEX "InventoryWaste_userId_idx" ON "InventoryWaste"("userId");

-- CreateIndex
CREATE INDEX "InventoryWaste_wasteDate_idx" ON "InventoryWaste"("wasteDate");

-- CreateIndex
CREATE INDEX "InventoryWaste_reason_idx" ON "InventoryWaste"("reason");

-- AddForeignKey
ALTER TABLE "InventoryWaste" ADD CONSTRAINT "InventoryWaste_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "MedicalStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWaste" ADD CONSTRAINT "InventoryWaste_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWaste" ADD CONSTRAINT "InventoryWaste_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
