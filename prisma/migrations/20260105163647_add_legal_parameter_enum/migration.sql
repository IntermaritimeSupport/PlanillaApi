/*
  Warnings:

  - Changed the type of `key` on the `LegalParameter` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "LegalParameterKey" AS ENUM ('ss_empleado', 'ss_patrono', 'ss_decimo', 'se_empleado', 'se_patrono', 'riesgo_profesional', 'isr_r1', 'isr_r2', 'isr_r3', 'decimo_css');

-- AlterTable
ALTER TABLE "LegalParameter" DROP COLUMN "key",
ADD COLUMN     "key" "LegalParameterKey" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LegalParameter_companyId_key_key" ON "LegalParameter"("companyId", "key");
