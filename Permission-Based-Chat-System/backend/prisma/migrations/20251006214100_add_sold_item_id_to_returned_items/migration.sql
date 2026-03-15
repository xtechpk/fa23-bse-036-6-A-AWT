-- AlterTable
ALTER TABLE "ReturnedItems" ADD COLUMN     "soldItemId" INTEGER;

-- CreateIndex
CREATE INDEX "ReturnedItems_soldItemId_idx" ON "ReturnedItems"("soldItemId");

-- AddForeignKey
ALTER TABLE "ReturnedItems" ADD CONSTRAINT "ReturnedItems_soldItemId_fkey" FOREIGN KEY ("soldItemId") REFERENCES "SoldItems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
