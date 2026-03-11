import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';
import { Decimal } from '@prisma/client/runtime/library.js';

type DeductionInput = { type?: string; description?: string; amount: number | string; isFixed?: boolean };
type AllowanceInput  = { type?: string; description?: string; amount: number | string };

export class PayrollController {
    // GET /api/payroll/payrolls/summary?companyId=&year=
  async getPayrollSummary(req: Request, res: Response) {
    try {
      const { companyId, year } = req.query;
      if (!companyId) return res.status(400).json({ error: 'companyId requerido.' });

      const yearNum = year ? parseInt(year as string) : new Date().getFullYear();
      const startDate = new Date(yearNum, 0, 1);
      const endDate   = new Date(yearNum, 11, 31);

      const runs = await prisma.payrollRun.findMany({
        where: { companyId: companyId as string, periodDate: { gte: startDate, lte: endDate } },
        include: { payrolls: { select: { grossSalary: true, netSalary: true, totalDeductions: true } } },
        orderBy: { periodDate: 'asc' },
      });

      const summary = runs.map(r => ({
        id: r.id,
        month: new Date(r.periodDate).getMonth() + 1,
        periodDate: r.periodDate,
        quincena: r.quincena,
        payrollType: r.payrollType,
        status: r.status,
        totalGross: Number(r.totalGross),
        totalNet: Number(r.totalNet),
        totalDeductions: Number(r.totalDeductions),
        count: r.payrolls.length,
      }));

      return res.status(200).json({ year: yearNum, companyId, summary });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      return res.status(500).json({ error: 'Error al obtener resumen de nóminas.', details: msg });
    }
  }
  // PATCH /api/payroll/payrolls/:id/lock  → cambia status a APPROVED
  async lockPayroll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const run = await prisma.payrollRun.findUnique({ where: { id } });
      if (!run) return res.status(404).json({ error: 'Nómina no encontrada.' });
      if (run.status === 'APPROVED') return res.status(409).json({ error: 'La nómina ya está bloqueada.' });

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: { status: 'APPROVED', updatedAt: new Date() },
      });
      return res.status(200).json(updated);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al bloquear la nómina.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // PATCH /api/payroll/payrolls/:id/void  → cambia status a CANCELLED
  async voidPayroll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const run = await prisma.payrollRun.findUnique({ where: { id } });
      if (!run) return res.status(404).json({ error: 'Nómina no encontrada.' });

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: { status: 'CANCELLED', updatedAt: new Date() },
      });
      return res.status(200).json(updated);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al anular la nómina.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // GET /api/payroll/payrolls/runs?companyId=&year=&month=&status=
  async getPayrollRuns(req: Request, res: Response) {
    try {
      const { companyId, year, month, status } = req.query;
      if (!companyId) return res.status(400).json({ error: 'companyId requerido.' });

      const where: Prisma.PayrollRunWhereInput = { companyId: companyId as string };
      if (status) where.status = status as string;
      if (year) {
        const y = parseInt(year as string);
        const m = month ? parseInt(month as string) - 1 : undefined;
        if (m !== undefined) {
          where.periodDate = { gte: new Date(y, m, 1), lte: new Date(y, m, 31) };
        } else {
          where.periodDate = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31) };
        }
      }

      const runs = await prisma.payrollRun.findMany({
        where,
        include: {
          payrolls: {
            include: {
              employee: { select: { id: true, cedula: true, firstName: true, lastName: true, department: true } },
              deductions: true,
              allowances: true,
            },
          },
          company: { select: { id: true, name: true } },
        },
        orderBy: { periodDate: 'desc' },
      });

      return res.status(200).json(runs);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al obtener nóminas.', details: error instanceof Error ? error.message : String(error) });
    }
  }
  async generatePayroll(req: Request, res: Response) {
    const {
      employeeId,
      payPeriod,
      paymentDate,
      baseSalary,
      workingDays = 30,
      daysWorked = 30,
      quincena = 1,
      payrollType = 'REGULAR',
      deductions = [],
      allowances = [],
    } = req.body;

    try {
      if (!employeeId || !payPeriod || !baseSalary) {
        return res.status(400).json({
          error: 'Empleado, período y salario base son obligatorios.',
        });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      // Convertir a primer día del mes
      const periodDate = new Date(payPeriod);
      periodDate.setDate(1);

      // Upsert atómico — evita race condition del findUnique+create anterior
      const payrollRun = await prisma.payrollRun.upsert({
        where: {
          companyId_periodDate_quincena_payrollType: {
            companyId: employee.companyId,
            periodDate,
            quincena,
            payrollType,
          },
        },
        update: {},
        create: {
          companyId: employee.companyId,
          periodDate,
          quincena,
          payrollType,
          status: 'DRAFT',
        },
      });

      // Calcular salario prorrateado
      const dailySalary = new Decimal(baseSalary).dividedBy(workingDays);
      const prorateSalary = dailySalary.times(daysWorked);

      // Calcular deducciones totales
      const sss            = prorateSalary.times(0.0875);
      const taxableIncome  = prorateSalary.minus(sss);
      const incomeTax      = this.calculatePanamaCorporateTax(taxableIncome);
      const privateInsurance = new Decimal(0);

      let customDeductions = new Decimal(0);
      (deductions as DeductionInput[]).forEach((d) => {
        customDeductions = customDeductions.plus(d.amount);
      });

      const totalDeductions = sss.plus(incomeTax).plus(privateInsurance).plus(customDeductions);

      let totalAllowances = new Decimal(0);
      (allowances as AllowanceInput[]).forEach((a) => {
        totalAllowances = totalAllowances.plus(a.amount);
      });

      const grossSalary = prorateSalary.plus(totalAllowances);
      const netSalary = grossSalary.minus(totalDeductions);

      // Generar número único de nómina
      const payrollNumber = `PR-${employeeId.substring(0, 8)}-${Date.now()}`;

      // Calcular Décimo Tercer Mes si aplica
      let thirteenthMonthAmount = new Decimal(0);
      let thirteenthMonthNote = '';

      if (payrollType === 'THIRTEEN_MONTH') {
        const hireDate  = new Date(employee.hireDate);
        const endOfYear = new Date(periodDate.getFullYear(), 11, 31);

        let monthsWorkedThisYear = 12;

        if (hireDate.getFullYear() === periodDate.getFullYear()) {
          const diffTime = endOfYear.getTime() - hireDate.getTime();
          monthsWorkedThisYear = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)));
          thirteenthMonthNote = `Proporcional: ${monthsWorkedThisYear} meses trabajados en el año`;
        }

        thirteenthMonthAmount = new Decimal(baseSalary)
          .times(monthsWorkedThisYear)
          .dividedBy(12);
      }

      // Crear el Payroll vinculado al PayrollRun
      const payroll = await prisma.payroll.create({
        data: {
          payrollNumber,
          payrollRunId: payrollRun.id,
          employeeId,
          companyId: employee.companyId,
          payPeriod: new Date(payPeriod),
          paymentDate: new Date(paymentDate ?? new Date()),
          payrollType,
          baseSalary: new Decimal(baseSalary),
          workingDays,
          daysWorked,
          grossSalary,
          incomeTax,
          sss,
          privateInsurance,
          customDeductions,
          totalDeductions,
          netSalary,
          thirteenthMonthAmount: payrollType === 'THIRTEEN_MONTH' ? thirteenthMonthAmount : new Decimal(0),
          thirteenthMonthNote,
          status: 'DRAFT',
          deductions: {
            create: (deductions as DeductionInput[]).map((d) => ({
              employeeId,
              deductionType: d.type ?? 'OTHER',
              description: d.description,
              amount: new Decimal(d.amount),
              isFixed: d.isFixed ?? false,
            })) as Prisma.DeductionUncheckedCreateWithoutPayrollInput[],
          },
          allowances: {
            create: (allowances as AllowanceInput[]).map((a) => ({
              employeeId,
              allowanceType: a.type ?? 'OTHER',
              description: a.description,
              amount: new Decimal(a.amount),
            })) as Prisma.AllowanceUncheckedCreateWithoutPayrollInput[],
          },
        },
        include: {
          employee: true,
          company: true,
          payrollRun: true,
          deductions: true,
          allowances: true,
        },
      });

      // Actualizar totales del PayrollRun
      await this.updatePayrollRunTotals(payrollRun.id);

      return res.status(201).json(payroll);
    } catch (error: unknown) {
      console.error('Error generating payroll:', error);
      return res.status(500).json({
        error: 'Error al generar la nómina.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async generatePayrollBatch(req: Request, res: Response) {
    const {
      companyId,
      periodDate,
      quincena = 1,
      payrollType = 'REGULAR',
      payrolls: payrollsData,
    } = req.body;

    try {
      if (!companyId || !periodDate || !payrollsData || payrollsData.length === 0) {
        return res.status(400).json({
          error: 'CompanyId, período y lista de nóminas son obligatorios.',
        });
      }

      // Convertir a primer día del mes
      const normalizedPeriodDate = new Date(periodDate);
      normalizedPeriodDate.setDate(1);

      // Crear o buscar el PayrollRun maestro
      const payrollRun = await prisma.payrollRun.upsert({
        where: {
          companyId_periodDate_quincena_payrollType: {
            companyId,
            periodDate: normalizedPeriodDate,
            quincena,
            payrollType,
          },
        },
        update: {},
        create: {
          companyId,
          periodDate: normalizedPeriodDate,
          quincena,
          payrollType,
          status: 'DRAFT',
        },
      });

      // Crear todas las nóminas
      const createdPayrolls = [];
      let batchTotalGross = new Decimal(0);
      let batchTotalDeductions = new Decimal(0);
      let batchTotalNet = new Decimal(0);

      // ─── Batch fetch de empleados — evita N+1 ──────────────────────────────
      const employeeIds: string[] = (payrollsData as Array<{ employeeId: string }>).map((p) => p.employeeId);
      const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
      const employeeMap = new Map(employees.map((e) => [e.id, e]));
      // ────────────────────────────────────────────────────────────────────────

      for (const payrollData of payrollsData as Array<{
        employeeId: string; payPeriod: string; paymentDate?: string;
        baseSalary: number | string; workingDays?: number; daysWorked?: number;
        deductions?: DeductionInput[]; allowances?: AllowanceInput[];
      }>) {
        const {
          employeeId,
          payPeriod,
          paymentDate,
          baseSalary,
          workingDays = 30,
          daysWorked = 30,
          deductions = [],
          allowances = [],
        } = payrollData;

        const employee = employeeMap.get(employeeId);
        if (!employee) continue;

        const dailySalary   = new Decimal(baseSalary).dividedBy(workingDays);
        const prorateSalary = dailySalary.times(daysWorked);

        const sss            = prorateSalary.times(0.0875);
        const taxableIncome  = prorateSalary.minus(sss);
        const incomeTax      = this.calculatePanamaCorporateTax(taxableIncome);
        const privateInsurance = new Decimal(0);

        let customDeductions = new Decimal(0);
        deductions.forEach((d) => { customDeductions = customDeductions.plus(d.amount); });

        const totalDeductions = sss.plus(incomeTax).plus(privateInsurance).plus(customDeductions);

        let totalAllowances = new Decimal(0);
        allowances.forEach((a) => { totalAllowances = totalAllowances.plus(a.amount); });

        const grossSalary = prorateSalary.plus(totalAllowances);
        const netSalary = grossSalary.minus(totalDeductions);

        const payrollNumber = `PR-${employeeId.substring(0, 8)}-${Date.now()}`;

        const payroll = await prisma.payroll.create({
          data: {
            payrollNumber,
            payrollRunId: payrollRun.id,
            employeeId,
            companyId,
            payPeriod: new Date(payPeriod),
            paymentDate: new Date(paymentDate ?? new Date()),
            payrollType,
            baseSalary: new Decimal(baseSalary),
            workingDays,
            daysWorked,
            grossSalary,
            incomeTax,
            sss,
            privateInsurance,
            customDeductions,
            totalDeductions,
            netSalary,
            status: 'DRAFT',
            deductions: {
              create: deductions.map((d) => ({
                employeeId,
                deductionType: d.type ?? 'OTHER',
                description: d.description,
                amount: new Decimal(d.amount),
                isFixed: d.isFixed ?? false,
              })) as Prisma.DeductionUncheckedCreateWithoutPayrollInput[],
            },
            allowances: {
              create: allowances.map((a) => ({
                employeeId,
                allowanceType: a.type ?? 'OTHER',
                description: a.description,
                amount: new Decimal(a.amount),
              })) as Prisma.AllowanceUncheckedCreateWithoutPayrollInput[],
            },
          },
          include: {
            employee: true,
            deductions: true,
            allowances: true,
          },
        });

        createdPayrolls.push(payroll);
        batchTotalGross = batchTotalGross.plus(grossSalary);
        batchTotalDeductions = batchTotalDeductions.plus(totalDeductions);
        batchTotalNet = batchTotalNet.plus(netSalary);
      }

      // Actualizar totales del PayrollRun
      const updatedPayrollRun = await prisma.payrollRun.update({
        where: { id: payrollRun.id },
        data: {
          totalGross: batchTotalGross,
          totalDeductions: batchTotalDeductions,
          totalNet: batchTotalNet,
        },
        include: {
          payrolls: {
            include: {
              employee: true,
              deductions: true,
              allowances: true,
            },
          },
        },
      });

      return res.status(201).json({
        payrollRun: updatedPayrollRun,
        payrollsCreated: createdPayrolls.length,
      });
    } catch (error: unknown) {
      console.error('Error generating batch payroll:', error);
      return res.status(500).json({
        error: 'Error al generar el lote de nóminas.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getPayrolls(req: Request, res: Response) {
    try {
      const { employeeId, companyId, payrollRunId, status, startDate, endDate } = req.query;

      const where: Prisma.PayrollWhereInput = {};
      if (employeeId)   where.employeeId   = employeeId   as string;
      if (companyId)    where.companyId    = companyId    as string;
      if (payrollRunId) where.payrollRunId = payrollRunId as string;
      if (status)       where.status       = status       as string;

      if (startDate || endDate) {
        where.payPeriod = {};
        if (startDate) where.payPeriod.gte = new Date(startDate as string);
        if (endDate)   where.payPeriod.lte = new Date(endDate   as string);
      }

      const payrolls = await prisma.payroll.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              cedula: true,
              firstName: true,
              lastName: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          payrollRun: {
            select: {
              id: true,
              periodDate: true,
              quincena: true,
              status: true,
            },
          },
          deductions: true,
          allowances: true,
        },
        orderBy: { payPeriod: 'desc' },
      });

      return res.status(200).json(payrolls);
    } catch (error: unknown) {
      console.error('Error fetching payrolls:', error);
      return res.status(500).json({
        error: 'Error al obtener las nóminas.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getPayrollById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payroll = await prisma.payroll.findUnique({
        where: { id },
        include: {
          employee: true,
          company: true,
          payrollRun: true,
          deductions: true,
          allowances: true,
        },
      });

      if (!payroll) {
        return res.status(404).json({ error: 'Nómina no encontrada.' });
      }

      return res.status(200).json(payroll);
    } catch (error: unknown) {
      console.error('Error fetching payroll:', error);
      return res.status(500).json({
        error: 'Error al obtener la nómina.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getPayrollRun(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payrollRun = await prisma.payrollRun.findUnique({
        where: { id },
        include: {
          payrolls: {
            include: {
              employee: {
                select: {
                  id: true,
                  cedula: true,
                  firstName: true,
                  lastName: true,
                },
              },
              deductions: true,
              allowances: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!payrollRun) {
        return res.status(404).json({ error: 'Lote de nóminas no encontrado.' });
      }

      return res.status(200).json(payrollRun);
    } catch (error: unknown) {
      console.error('Error fetching payroll run:', error);
      return res.status(500).json({
        error: 'Error al obtener el lote de nóminas.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async approvePayroll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { approvedBy, comments } = req.body;

      const payroll = await prisma.payroll.findUnique({
        where: { id },
      });

      if (!payroll) {
        return res.status(404).json({ error: 'Nómina no encontrada.' });
      }

      const updated = await prisma.payroll.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvalDate: new Date(),
          comments,
        },
        include: {
          employee: true,
          deductions: true,
          allowances: true,
        },
      });

      // Actualizar totales del PayrollRun
      if (payroll.payrollRunId) {
        await this.updatePayrollRunTotals(payroll.payrollRunId);
      }

      return res.status(200).json(updated);
    } catch (error: unknown) {
      console.error('Error approving payroll:', error);
      return res.status(500).json({
        error: 'Error al aprobar la nómina.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async approvePayrollRun(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { approvedBy, comments } = req.body;

      const payrollRun = await prisma.payrollRun.findUnique({
        where: { id },
      });

      if (!payrollRun) {
        return res.status(404).json({ error: 'Lote de nóminas no encontrado.' });
      }

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: {
          status: 'APPROVED',
          createdByUserId: approvedBy,
          updatedAt: new Date(),
        },
        include: {
          payrolls: {
            include: {
              employee: true,
              deductions: true,
              allowances: true,
            },
          },
        },
      });

      return res.status(200).json(updated);
    } catch (error: unknown) {
      console.error('Error approving payroll run:', error);
      return res.status(500).json({
        error: 'Error al aprobar el lote de nóminas.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async rejectPayroll(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const payroll = await prisma.payroll.findUnique({
        where: { id },
      });

      if (!payroll) {
        return res.status(404).json({ error: 'Nómina no encontrada.' });
      }

      const updated = await prisma.payroll.update({
        where: { id },
        data: {
          status: 'REJECTED',
          comments,
        },
        include: {
          employee: true,
          deductions: true,
          allowances: true,
        },
      });

      // Actualizar totales del PayrollRun
      if (payroll.payrollRunId) {
        await this.updatePayrollRunTotals(payroll.payrollRunId);
      }

      return res.status(200).json(updated);
    } catch (error: unknown) {
      console.error('Error rejecting payroll:', error);
      return res.status(500).json({
        error: 'Error al rechazar la nómina.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
  

  private async updatePayrollRunTotals(payrollRunId: string): Promise<void> {
    try {
      const payrolls = await prisma.payroll.findMany({
        where: { payrollRunId },
      });

      let totalGross = new Decimal(0);
      let totalDeductions = new Decimal(0);
      let totalNet = new Decimal(0);

      payrolls.forEach((p) => {
        totalGross = totalGross.plus(p.grossSalary);
        totalDeductions = totalDeductions.plus(p.totalDeductions);
        totalNet = totalNet.plus(p.netSalary);
      });

      await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          totalGross,
          totalDeductions,
          totalNet,
        },
      });
    } catch (error) {
      console.error('Error updating payroll run totals:', error);
    }
  }

  private calculatePanamaCorporateTax(income: Decimal): Decimal {
    const incomeNum = income.toNumber();

    if (incomeNum <= 12000) {
      return new Decimal(0);
    } else if (incomeNum <= 36000) {
      return new Decimal((incomeNum - 12000) * 0.15);
    } else if (incomeNum <= 60000) {
      return new Decimal((36000 - 12000) * 0.15 + (incomeNum - 36000) * 0.2);
    } else {
      return new Decimal(
        (36000 - 12000) * 0.15 + (60000 - 36000) * 0.2 + (incomeNum - 60000) * 0.25
      );
    }
  }
  }
