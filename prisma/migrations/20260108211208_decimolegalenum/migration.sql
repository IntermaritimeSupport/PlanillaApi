/*
  Warnings:

  - Changed the type of `type` on the `LegalParameter` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category` on the `LegalParameter` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ParameterType" AS ENUM ('employee', 'employer', 'fixed');

-- CreateEnum
CREATE TYPE "ParameterCategory" AS ENUM ('social_security', 'educational_insurance', 'isr', 'other');

-- AlterTable
ALTER TABLE "LegalParameter" DROP COLUMN "type",
ADD COLUMN     "type" "ParameterType" NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "ParameterCategory" NOT NULL;

-- CreateTable
CREATE TABLE "LegalDecimoParameter" (
    "id" TEXT NOT NULL,
    "key" "LegalParameterKey" NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ParameterType" NOT NULL,
    "category" "ParameterCategory" NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "minRange" INTEGER,
    "maxRange" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDecimoParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDecimoParameter_companyId_idx" ON "LegalDecimoParameter"("companyId");

-- CreateIndex
CREATE INDEX "LegalDecimoParameter_category_idx" ON "LegalDecimoParameter"("category");

-- CreateIndex
CREATE INDEX "LegalDecimoParameter_status_idx" ON "LegalDecimoParameter"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDecimoParameter_companyId_key_key" ON "LegalDecimoParameter"("companyId", "key");

-- CreateIndex
CREATE INDEX "LegalParameter_category_idx" ON "LegalParameter"("category");

-- AddForeignKey
ALTER TABLE "LegalDecimoParameter" ADD CONSTRAINT "LegalDecimoParameter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
