-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "location" TEXT,
ADD COLUMN     "purchasePrice" DOUBLE PRECISION,
ADD COLUMN     "rank" TEXT,
ADD COLUMN     "sellingPrice" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Batch_expiryDate_idx" ON "Batch"("expiryDate");
