-- CreateEnum
CREATE TYPE "SalaryChangeReason" AS ENUM ('PROMOTION', 'ADJUSTMENT', 'CORRECTION', 'COST_OF_LIVING', 'PERFORMANCE', 'RESTRUCTURE', 'OTHER');

-- CreateTable salary_history
CREATE TABLE IF NOT EXISTS "salary_history" (
    "id"             TEXT NOT NULL,
    "employeeId"     TEXT NOT NULL,
    "previousSalary" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "newSalary"      DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "previousType"   TEXT NOT NULL,
    "newType"        TEXT NOT NULL,
    "changeReason"   "SalaryChangeReason" NOT NULL DEFAULT 'ADJUSTMENT',
    "notes"          TEXT,
    "effectiveDate"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable decimo_payments
CREATE TABLE IF NOT EXISTS "decimo_payments" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "year"        INTEGER NOT NULL,
    "partida"     INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decimo_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_history_employeeId_idx" ON "salary_history"("employeeId");
CREATE UNIQUE INDEX "decimo_payments_companyId_year_partida_key" ON "decimo_payments"("companyId", "year", "partida");
CREATE INDEX "decimo_payments_companyId_idx" ON "decimo_payments"("companyId");

-- AddForeignKey
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decimo_payments" ADD CONSTRAINT "decimo_payments_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
