import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/client.js';

export class PayrollController {
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

      // Buscar o crear el PayrollRun
      let payrollRun = await prisma.payrollRun.findUnique({
        where: {
          companyId_periodDate_quincena_payrollType: {
            companyId: employee.companyId,
            periodDate,
            quincena,
            payrollType,
          },
        },
      });

      if (!payrollRun) {
        payrollRun = await prisma.payrollRun.create({
          data: {
            companyId: employee.companyId,
            periodDate,
            quincena,
            payrollType,
            status: 'DRAFT',
          },
        });
      }

      // Calcular salario prorrateado
      const dailySalary = new Decimal(baseSalary).dividedBy(workingDays);
      const prorateSalary = dailySalary.times(daysWorked);

      // Calcular deducciones totales
      let totalDeductions = new Decimal(0);
      let incomeTax = new Decimal(0);
      let sss = new Decimal(0);
      let privateInsurance = new Decimal(0);

      // SSS: 8.75% del salario
      sss = prorateSalary.times(0.0875);

      // ISR: Se calcula según la ley panameña
      const taxableIncome = prorateSalary.minus(sss);
      incomeTax = this.calculatePanamaCorporateTax(taxableIncome);

      // Otras deducciones
      let customDeductions = new Decimal(0);
      deductions.forEach((d: any) => {
        customDeductions = customDeductions.plus(d.amount);
      });

      totalDeductions = sss.plus(incomeTax).plus(privateInsurance).plus(customDeductions);

      // Calcular bonificaciones
      let totalAllowances = new Decimal(0);
      allowances.forEach((a: any) => {
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
        const hireDateThisYear = new Date(employee.hireDate);
        const endOfYear = new Date(periodDate.getFullYear(), 11, 31);

        let monthsWorkedThisYear = 12;

        if (hireDateThisYear.getFullYear() === periodDate.getFullYear()) {
          const diffTime = endOfYear.getTime() - hireDateThisYear.getTime();
          monthsWorkedThisYear = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
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
          paymentDate: new Date(paymentDate || new Date()),
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
            create: deductions.map((d: any) => ({
              employeeId,
              deductionType: d.type || 'OTHER',
              description: d.description,
              amount: new Decimal(d.amount),
              isFixed: d.isFixed || false,
            })),
          },
          allowances: {
            create: allowances.map((a: any) => ({
              employeeId,
              allowanceType: a.type || 'OTHER',
              description: a.description,
              amount: new Decimal(a.amount),
            })),
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
    } catch (error: any) {
      console.error('Error generating payroll:', error);
      return res.status(500).json({
        error: 'Error al generar la nómina.',
        details: error.message,
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

      for (const payrollData of payrollsData) {
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

        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
        });

        if (!employee) continue;

        const dailySalary = new Decimal(baseSalary).dividedBy(workingDays);
        const prorateSalary = dailySalary.times(daysWorked);

        let sss = prorateSalary.times(0.0875);
        const taxableIncome = prorateSalary.minus(sss);
        let incomeTax = this.calculatePanamaCorporateTax(taxableIncome);
        let privateInsurance = new Decimal(0);

        let customDeductions = new Decimal(0);
        deductions.forEach((d: any) => {
          customDeductions = customDeductions.plus(d.amount);
        });

        let totalDeductions = sss.plus(incomeTax).plus(privateInsurance).plus(customDeductions);

        let totalAllowances = new Decimal(0);
        allowances.forEach((a: any) => {
          totalAllowances = totalAllowances.plus(a.amount);
        });

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
            paymentDate: new Date(paymentDate || new Date()),
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
              create: deductions.map((d: any) => ({
                employeeId,
                deductionType: d.type || 'OTHER',
                description: d.description,
                amount: new Decimal(d.amount),
                isFixed: d.isFixed || false,
              })),
            },
            allowances: {
              create: allowances.map((a: any) => ({
                employeeId,
                allowanceType: a.type || 'OTHER',
                description: a.description,
                amount: new Decimal(a.amount),
              })),
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
    } catch (error: any) {
      console.error('Error generating batch payroll:', error);
      return res.status(500).json({
        error: 'Error al generar el lote de nóminas.',
        details: error.message,
      });
    }
  }

  async getPayrolls(req: Request, res: Response) {
    try {
      const { employeeId, companyId, payrollRunId, status, startDate, endDate } = req.query;

      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (companyId) where.companyId = companyId;
      if (payrollRunId) where.payrollRunId = payrollRunId;
      if (status) where.status = status;

      if (startDate || endDate) {
        where.payPeriod = {};
        if (startDate) where.payPeriod.gte = new Date(startDate as string);
        if (endDate) where.payPeriod.lte = new Date(endDate as string);
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
    } catch (error: any) {
      console.error('Error fetching payrolls:', error);
      return res.status(500).json({
        error: 'Error al obtener las nóminas.',
        details: error.message,
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
    } catch (error: any) {
      console.error('Error fetching payroll:', error);
      return res.status(500).json({
        error: 'Error al obtener la nómina.',
        details: error.message,
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
    } catch (error: any) {
      console.error('Error fetching payroll run:', error);
      return res.status(500).json({
        error: 'Error al obtener el lote de nóminas.',
        details: error.message,
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
    } catch (error: any) {
      console.error('Error approving payroll:', error);
      return res.status(500).json({
        error: 'Error al aprobar la nómina.',
        details: error.message,
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
    } catch (error: any) {
      console.error('Error approving payroll run:', error);
      return res.status(500).json({
        error: 'Error al aprobar el lote de nóminas.',
        details: error.message,
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
    } catch (error: any) {
      console.error('Error rejecting payroll:', error);
      return res.status(500).json({
        error: 'Error al rechazar la nómina.',
        details: error.message,
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