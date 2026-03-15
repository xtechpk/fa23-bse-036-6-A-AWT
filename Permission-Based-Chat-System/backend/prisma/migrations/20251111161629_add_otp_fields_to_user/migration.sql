/*
  Warnings:

  - Made the column `name` on table `SubUnit` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SubUnit" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3);
