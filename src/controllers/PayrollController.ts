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

      // Calcular salario prorrateado
      const dailySalary = new Decimal(baseSalary).dividedBy(workingDays);
      const prorateSalary = dailySalary.times(daysWorked);

      // Calcular deducciones totales
      let totalDeductions = new Decimal(0);
      let incomeTax = new Decimal(0);
      let sss = new Decimal(0);

      // SSS: 8.75% del salario
      sss = prorateSalary.times(0.0875);

      // ISR: Se calcula según la ley panameña (depende de tramos)
      const taxableIncome = prorateSalary.minus(sss);
      incomeTax = this.calculatePanamaCorporateTax(taxableIncome);

      // Otras deducciones
      let customDeductions = new Decimal(0);
      deductions.forEach((d: any) => {
        customDeductions = customDeductions.plus(d.amount);
      });

      totalDeductions = sss.plus(incomeTax).plus(customDeductions);

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
        // Cálculo del 13er mes en Panamá:
        // = (Salario base × 12 meses) / 12 = Salario base (simplificado)
        // O proporcional si no ha cumplido el año completo
        
        const hireDateThisYear = new Date(employee.hireDate);
        const endOfYear = new Date(new Date(payPeriod).getFullYear(), 11, 31);
        const thisYearStart = new Date(new Date(payPeriod).getFullYear(), 0, 1);

        // Calcular meses trabajados en el año
        let monthsWorkedThisYear = 12;

        if (hireDateThisYear.getFullYear() === new Date(payPeriod).getFullYear()) {
          const diffTime = endOfYear.getTime() - hireDateThisYear.getTime();
          monthsWorkedThisYear = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
          thirteenthMonthNote = `Proporcional: ${monthsWorkedThisYear} meses trabajados en el año`;
        }

        // 13er mes = (Salario mensual × meses trabajados) / 12
        thirteenthMonthAmount = new Decimal(baseSalary)
          .times(monthsWorkedThisYear)
          .dividedBy(12);
      }

      const payroll = await prisma.payroll.create({
        data: {
          payrollNumber,
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
          deductions: true,
          allowances: true,
        },
      });

      return res.status(201).json(payroll);
    } catch (error: any) {
      console.error('Error generating payroll:', error);
      return res.status(500).json({
        error: 'Error al generar la nómina.',
        details: error.message,
      });
    }
  }

  async getPayrolls(req: Request, res: Response) {
    try {
      const { employeeId, companyId, status, startDate, endDate } = req.query;

      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (companyId) where.companyId = companyId;
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

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error approving payroll:', error);
      return res.status(500).json({
        error: 'Error al aprobar la nómina.',
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

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error rejecting payroll:', error);
      return res.status(500).json({
        error: 'Error al rechazar la nómina.',
        details: error.message,
      });
    }
  }

  private calculatePanamaCorporateTax(income: Decimal): Decimal {
    // Impuesto sobre la Renta en Panamá (simplificado)
    // Escala 2024: 
    // 0 a 12,000: 0%
    // 12,001 a 36,000: 15%
    // 36,001 a 60,000: 20%
    // Más de 60,000: 25%

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

  // Calcular el Décimo Tercer Mes
  private calculateThirteenthMonth(
    employee: any,
    baseSalary: Decimal,
    payrollDate: Date,
    payrollType: string
  ): { amount: Decimal; note: string } {
    if (payrollType !== 'THIRTEEN_MONTH') {
      return { amount: new Decimal(0), note: '' };
    }

    const hireDate = new Date(employee.hireDate);
    const payrollYear = payrollDate.getFullYear();
    const decemberOfPayrollYear = new Date(payrollYear, 11, 31);

    // Si el empleado fue contratado este año, calcular proporcional
    if (hireDate.getFullYear() === payrollYear) {
      // Calcular desde la fecha de contratación hasta el 31 de diciembre
      const monthsWorked = this.calculateMonthsBetween(hireDate, decemberOfPayrollYear);
      const thirteenthAmount = new Decimal(baseSalary)
        .times(monthsWorked)
        .dividedBy(12);

      return {
        amount: thirteenthAmount,
        note: `Prorratizado: ${monthsWorked} meses trabajados (desde ${hireDate.toLocaleDateString('es-PA')})`,
      };
    }

    // Si fue contratado hace más de un año, el 13er mes es el salario base completo
    const thirteenthAmount = new Decimal(baseSalary);
    return {
      amount: thirteenthAmount,
      note: 'Décimo Tercer Mes completo (12 meses trabajados)',
    };
  }

  // Calcular diferencia en meses
  private calculateMonthsBetween(startDate: Date, endDate: Date): number {
    let months = 0;
    const temp = new Date(startDate);

    while (temp < endDate) {
      temp.setMonth(temp.getMonth() + 1);
      if (temp <= endDate) months++;
    }

    return months;
  }
}