-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('owner', 'admin', 'member');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "avatarFileId" TEXT;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN "role" "GroupMemberRole" NOT NULL DEFAULT 'member';

-- Backfill owner role for current group creators
UPDATE "GroupMember" gm
SET "role" = 'owner'
FROM "Group" g
WHERE gm."groupId" = g."id"
  AND gm."userId" = g."createdById";

-- CreateIndex
CREATE UNIQUE INDEX "Group_avatarFileId_key" ON "Group"("avatarFileId");

-- AddForeignKey
ALTER TABLE "Group"
ADD CONSTRAINT "Group_avatarFileId_fkey"
FOREIGN KEY ("avatarFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
