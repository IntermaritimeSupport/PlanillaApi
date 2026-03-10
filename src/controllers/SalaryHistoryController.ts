// src/controllers/SalaryHistoryController.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class SalaryHistoryController {

  // GET /api/payroll/employees/:id/salary-history
  async getByEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await prisma.employee.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          cedula: true,
          salary: true,
          salaryType: true,
        },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      const history = await prisma.salaryHistory.findMany({
        where: { employeeId: id },
        orderBy: { effectiveDate: 'desc' },
      });

      return res.status(200).json({
        employee,
        history,
        total: history.length,
      });
    } catch (error: any) {
      console.error('Error fetching salary history:', error);
      return res.status(500).json({
        error: 'Error al obtener el historial de salarios.',
        details: error.message,
      });
    }
  }

  // POST /api/payroll/employees/:id/salary-history  (registro manual si se necesita)
  async create(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        previousSalary,
        newSalary,
        previousType,
        newType,
        changeReason,
        notes,
        changedBy,
      } = req.body;

      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      const record = await prisma.salaryHistory.create({
        data: {
          employeeId: id,
          previousSalary: Number(previousSalary) || 0,
          newSalary: Number(newSalary) || 0,
          previousType: previousType || 'MONTHLY',
          newType: newType || 'MONTHLY',
          changeReason: changeReason || 'ADJUSTMENT',
          notes: notes || null,
          changedBy: changedBy || null,
          effectiveDate: new Date(),
        },
      });

      return res.status(201).json(record);
    } catch (error: any) {
      console.error('Error creating salary history:', error);
      return res.status(500).json({
        error: 'Error al registrar el historial de salario.',
        details: error.message,
      });
    }
  }
}
