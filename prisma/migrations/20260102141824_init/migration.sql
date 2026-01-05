-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'BIWEEKLY');

-- CreateEnum
CREATE TYPE "PayrollType" AS ENUM ('REGULAR', 'THIRTEEN_MONTH');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('SSS', 'ISR', 'PRIVATE_INSURANCE', 'LOAN', 'ADVANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "AllowanceType" AS ENUM ('OVERTIME', 'BONUS', 'COMMISSION', 'LUNCH_VOUCHER', 'TRANSPORTATION', 'HOUSING', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'EXCUSED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('VACATION', 'SICK_LEAVE', 'MATERNITY_LEAVE', 'PERSONAL_LEAVE', 'UNPAID_LEAVE', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('Activo', 'Inactivo');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompany" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("userId","companyId")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "contactEmail" TEXT,
    "phoneNumber" TEXT,
    "departmentId" TEXT,
    "position" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'Activo',
    "userCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "ruc" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "salary" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "salaryType" "SalaryType" NOT NULL DEFAULT 'MONTHLY',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "bankAccount" TEXT,
    "bankName" TEXT,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "payrollNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payPeriod" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "payrollType" "PayrollType" NOT NULL DEFAULT 'REGULAR',
    "baseSalary" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "workingDays" INTEGER NOT NULL DEFAULT 30,
    "daysWorked" INTEGER NOT NULL DEFAULT 30,
    "grossSalary" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "incomeTax" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "sss" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "privateInsurance" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "customDeductions" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "totalDeductions" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "netSalary" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "thirteenthMonthAmount" DECIMAL(65,30) DEFAULT 0.00,
    "thirteenthMonthNote" TEXT,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT,
    "employeeId" TEXT NOT NULL,
    "deductionType" "DeductionType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allowance" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT,
    "employeeId" TEXT NOT NULL,
    "allowanceType" "AllowanceType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "hoursWorked" DECIMAL(65,30),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysRequested" INTEGER NOT NULL,
    "daysApproved" INTEGER,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalParameter" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "minRange" INTEGER,
    "maxRange" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Person_userId_key" ON "Person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_userCode_key" ON "Person"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ruc_key" ON "Company"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_cedula_key" ON "Employee"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Employee_cedula_idx" ON "Employee"("cedula");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_payrollNumber_key" ON "Payroll"("payrollNumber");

-- CreateIndex
CREATE INDEX "Payroll_employeeId_idx" ON "Payroll"("employeeId");

-- CreateIndex
CREATE INDEX "Payroll_companyId_idx" ON "Payroll"("companyId");

-- CreateIndex
CREATE INDEX "Payroll_payPeriod_idx" ON "Payroll"("payPeriod");

-- CreateIndex
CREATE INDEX "Payroll_payrollType_idx" ON "Payroll"("payrollType");

-- CreateIndex
CREATE INDEX "Deduction_employeeId_idx" ON "Deduction"("employeeId");

-- CreateIndex
CREATE INDEX "Deduction_payrollId_idx" ON "Deduction"("payrollId");

-- CreateIndex
CREATE INDEX "Allowance_employeeId_idx" ON "Allowance"("employeeId");

-- CreateIndex
CREATE INDEX "Allowance_payrollId_idx" ON "Allowance"("payrollId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_employeeId_idx" ON "AttendanceRecord"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_idx" ON "AttendanceRecord"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_date_key" ON "AttendanceRecord"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Leave_employeeId_idx" ON "Leave"("employeeId");

-- CreateIndex
CREATE INDEX "Leave_companyId_idx" ON "Leave"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalParameter_key_key" ON "LegalParameter"("key");

-- CreateIndex
CREATE INDEX "LegalParameter_category_idx" ON "LegalParameter"("category");

-- CreateIndex
CREATE INDEX "LegalParameter_status_idx" ON "LegalParameter"("status");

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allowance" ADD CONSTRAINT "Allowance_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allowance" ADD CONSTRAINT "Allowance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
