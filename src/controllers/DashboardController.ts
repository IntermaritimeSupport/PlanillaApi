import { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/index.js';
import prisma from '../../lib/prisma.js';
import { getCompanyFilter } from '../middlewares/authGuards.js';

export class DashboardController {
  /**
   * Obtiene estadísticas generales del dashboard
   * Sin autenticación - retorna datos globales
   */
  async getGeneralStats(req: Request, res: Response): Promise<void> {
    try {
      const companyId = getCompanyFilter(req as any, req.query.companyId as string | undefined);
      const cWhere = companyId ? { companyId } : {};
      const stats = {
        totalCompanies: companyId ? 1 : await prisma.company.count(),
        totalUsers: await prisma.user.count({ where: companyId ? { companies: { some: { companyId } } } : {} }),
        totalEmployees: await prisma.employee.count({ where: cWhere }),
        totalPayrolls: await prisma.payroll.count({ where: cWhere }),
        totalDepartments: await prisma.department.count({ where: cWhere }),
        activeEmployees: await prisma.employee.count({ where: { ...cWhere, status: 'ACTIVE' } }),
        inactiveEmployees: await prisma.employee.count({ where: { ...cWhere, status: { not: 'ACTIVE' } } }),
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: unknown) {
      console.error('Error fetching general stats:', error);
      res.status(500).json({
        error: 'Error al obtener estadísticas generales',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtiene información de nóminas recientes
   */
  async getRecentPayrolls(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10, companyId } = req.query;

      // Construir filtro de compañía si se proporciona
      const where: Prisma.PayrollWhereInput = {};
      if (companyId) {
        where.companyId = String(companyId);
      }

      const payrolls = await prisma.payroll.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              cedula: true,
              salary: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string) || 10,
      });

      res.status(200).json({
        success: true,
        data: payrolls,
      });
    } catch (error: unknown) {
      console.error('Error fetching recent payrolls:', error);
      res.status(500).json({
        error: 'Error al obtener nóminas recientes',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtiene datos financieros resumidos (totales de nóminas)
   */
  async getFinancialSummary(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, monthYear } = req.query;

      // Construir filtro
      const where: Prisma.PayrollWhereInput = {};
      if (companyId) {
        where.companyId = String(companyId);
      }

      // Construir el filtro de fecha si se proporciona
      if (monthYear) {
        const [year, month] = (monthYear as string).split('-');
        const startDate = new Date(`${year}-${month}-01`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        where.payPeriod = {
          gte: startDate,
          lt: endDate,
        };
      }

      const payrolls = await prisma.payroll.findMany({
        where,
        select: {
          id: true,
          grossSalary: true,
          totalDeductions: true,
          netSalary: true,
          incomeTax: true,
          sss: true,
          status: true,
        },
      });

      // Calcular totales
      const summary = {
        totalGross: payrolls.reduce((acc, p) => acc + Number(p.grossSalary), 0),
        totalDeductions: payrolls.reduce(
          (acc, p) => acc + Number(p.totalDeductions),
          0
        ),
        totalNet: payrolls.reduce((acc, p) => acc + Number(p.netSalary), 0),
        totalTax: payrolls.reduce((acc, p) => acc + Number(p.incomeTax), 0),
        totalSSS: payrolls.reduce((acc, p) => acc + Number(p.sss), 0),
        payrollCount: payrolls.length,
        averageSalary:
          payrolls.length > 0
            ? payrolls.reduce((acc, p) => acc + Number(p.netSalary), 0) /
              payrolls.length
            : 0,
      };

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error: unknown) {
      console.error('Error fetching financial summary:', error);
      res.status(500).json({
        error: 'Error al obtener resumen financiero',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtiene datos de empleados por departamento
   */
  async getEmployeesByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.query;

      const deptWhere: Prisma.DepartmentWhereInput = {};
      const empWhere: Prisma.EmployeeWhereInput = {};
      if (companyId) {
        deptWhere.companyId = String(companyId);
        empWhere.companyId  = String(companyId);
      }

      const departments = await prisma.department.findMany({
        where: deptWhere,
        include: {
          persons: {
            select: { id: true, firstName: true, lastName: true, status: true },
          },
        },
      });

      const employeesByDept = await prisma.employee.groupBy({
        by: ['department'],
        where: empWhere,
        _count: { id: true },
      });

      res.status(200).json({
        success: true,
        data: { departments, employeesByDept },
      });
    } catch (error: unknown) {
      console.error('Error fetching employees by department:', error);
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Error al obtener empleados por departamento', details: msg });
    }
  }

  /**
   * Obtiene datos de ausencias y asistencia
   */
  async getAttendanceStats(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, days = 30 } = req.query;

      const companyFilter = companyId ? { companyId: String(companyId) } : {};

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

      const attendanceStats = await prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { ...companyFilter, date: { gte: daysAgo } },
        _count: { id: true },
      });

      const leaveStats = await prisma.leave.groupBy({
        by: ['leaveType'],
        where: { ...companyFilter, createdAt: { gte: daysAgo } },
        _count: { id: true },
      });

      res.status(200).json({
        success: true,
        data: {
          attendance: attendanceStats,
          leaves: leaveStats,
        },
      });
    } catch (error: unknown) {
      console.error('Error fetching attendance stats:', error);
      res.status(500).json({
        error: 'Error al obtener estadísticas de asistencia',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtiene información general del usuario autenticado
   */
  async getCurrentUserInfo(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = req.userId;

      // Si no hay usuario autenticado, retornar información anónima
      if (!requestingUserId) {
        res.status(200).json({
          success: true,
          data: {
            id: 'anonymous',
            username: 'anonymous',
            email: 'anonymous@example.com',
            role: 'GUEST',
            isActive: true,
            person: null,
            companies: [],
          },
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: requestingUserId },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: unknown) {
      console.error('Error fetching current user info:', error);
      res.status(500).json({
        error: 'Error al obtener información del usuario',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtiene todas las compañías disponibles
   */
  async getUserCompanies(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = req.userId;

      // Si hay usuario autenticado, obtener sus compañías
      if (requestingUserId) {
        const user = await prisma.user.findUnique({
          where: { id: requestingUserId },
          include: {
            companies: {
              include: {
                company: true,
              },
            },
          },
        });

        if (user) {
          const companies = user.companies.map((uc) => uc.company);
          res.status(200).json({
            success: true,
            data: companies,
          });
          return;
        }
      }

      res.status(401).json({ error: 'No autenticado.' });
    } catch (error: unknown) {
      console.error('Error fetching user companies:', error);
      res.status(500).json({
        error: 'Error al obtener compañías del usuario',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}