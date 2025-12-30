-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_userId_fkey";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "code" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
