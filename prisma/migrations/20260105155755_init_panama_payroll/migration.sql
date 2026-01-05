/*
  Warnings:

  - A unique constraint covering the columns `[companyId,key]` on the table `LegalParameter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `LegalParameter` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LegalParameter_key_key";

-- AlterTable
ALTER TABLE "LegalParameter" ADD COLUMN     "companyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "LegalParameter_companyId_idx" ON "LegalParameter"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalParameter_companyId_key_key" ON "LegalParameter"("companyId", "key");

-- AddForeignKey
ALTER TABLE "LegalParameter" ADD CONSTRAINT "LegalParameter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
