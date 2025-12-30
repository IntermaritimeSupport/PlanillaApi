import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class EmployeeController {
  // Crear nuevo empleado
  async create(req: Request, res: Response) {
    const {
      cedula,
      firstName,
      lastName,
      email,
      phoneNumber,
      position,
      department,
      hireDate,
      salary,
      salaryType,
      bankAccount,
      bankName,
      userId,
      companyId,
    } = req.body;

    try {
      // 1. Validaciones iniciales
      if (!cedula || !firstName || !lastName || !companyId) {
        return res.status(400).json({
          error: 'Cédula, nombre, apellido y compañía son obligatorios.',
        });
      }

      // 2. Validar que la compañía exista
      const companyExists = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!companyExists) {
        return res.status(404).json({ error: 'Compañía no encontrada.' });
      }

      // 3. Preparar el objeto de datos dinámicamente
      // Solo incluimos userId si es un string con contenido para evitar errores de FK
      const employeeData: any = {
        cedula,
        firstName,
        lastName,
        email: email || null,
        phoneNumber: phoneNumber || null,
        position: position || null,
        department: department || null,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        salary: Number(salary) || 0,
        salaryType: salaryType || 'MONTHLY',
        bankAccount: bankAccount || "",
        bankName: bankName || "",
        companyId,
        status: 'ACTIVE',
      };

      // 4. Lógica de vinculación de Usuario (Opcional)
      if (userId && userId.trim() !== "") {
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!userExists) {
          return res.status(404).json({ error: 'El usuario de acceso proporcionado no existe.' });
        }

        const userAlreadyAssigned = await prisma.employee.findUnique({
          where: { userId },
        });

        if (userAlreadyAssigned) {
          return res.status(409).json({ error: 'Este usuario ya está asignado a otro empleado.' });
        }

        // Si todo está bien, lo agregamos al objeto de creación
        employeeData.userId = userId;
      }

      // 5. Crear empleado en la base de datos
      const newEmployee = await prisma.employee.create({
        data: employeeData,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
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

      return res.status(201).json(newEmployee);
    } catch (error: any) {
      if (error.code === 'P2002') {
        let errorMessage = 'La cédula o el email ya están registrados.';
        if (error.meta?.target?.includes('cedula')) errorMessage = 'Esta cédula ya existe.';
        return res.status(409).json({ error: errorMessage });
      }

      console.error('Error creating employee:', error);
      return res.status(500).json({
        error: 'Error interno al crear el empleado.',
        details: error.message,
      });
    }
  }

  // Obtener todos los empleados
  async getAll(req: Request, res: Response) {
    try {
      const { companyId, status } = req.query;

      const where: any = {};
      if (companyId) {
        where.companyId = companyId;
      }
      if (status) {
        where.status = status;
      }

      const employees = await prisma.employee.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
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
      });
      console.log('Fetched employees:', employees);
      return res.status(200).json(employees);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      return res.status(500).json({
        error: 'Error al obtener los empleados.',
        details: error.message,
      });
    }
  }

  // Obtener empleado por ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          user: true,
          company: true,
          payrolls: {
            orderBy: { payPeriod: 'desc' },
            take: 10,
          },
          deductions: {
            orderBy: { createdAt: 'desc' },
          },
          allowances: {
            orderBy: { createdAt: 'desc' },
          },
          attendanceRecords: {
            orderBy: { date: 'desc' },
            take: 30,
          },
          leaves: {
            orderBy: { startDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      return res.status(200).json(employee);
    } catch (error: any) {
      console.error('Error fetching employee:', error);
      return res.status(500).json({
        error: 'Error al obtener el empleado.',
        details: error.message,
      });
    }
  }

  // Actualizar empleado
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { userId, ...restOfData } = req.body;

      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) return res.status(404).json({ error: 'Empleado no encontrado.' });

      // Preparar objeto de actualización
      const updateData: any = { ...restOfData };

      if (restOfData.hireDate) updateData.hireDate = new Date(restOfData.hireDate);
      if (restOfData.salary) updateData.salary = Number(restOfData.salary);

      // Manejo de cambio de userId
      if (userId !== undefined) {
        if (userId === null || userId.trim() === "") {
          updateData.userId = null;
        } else if (userId !== employee.userId) {
          const userAlreadyAssigned = await prisma.employee.findUnique({ where: { userId } });
          if (userAlreadyAssigned) {
            return res.status(409).json({ error: 'Este usuario ya está asignado a otro empleado.' });
          }
          updateData.userId = userId;
        }
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, username: true, email: true, role: true } },
          company: { select: { id: true, name: true } },
        },
      });

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error updating employee:', error);
      return res.status(500).json({ error: 'Error al actualizar el empleado.' });
    }
  }

  // Eliminar empleado
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await prisma.employee.findUnique({
        where: { id },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      await prisma.employee.delete({
        where: { id },
      });

      return res.status(200).json({
        message: 'Empleado eliminado exitosamente.',
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }
      console.error('Error deleting employee:', error);
      return res.status(500).json({
        error: 'Error al eliminar el empleado.',
        details: error.message,
      });
    }
  }

  // Cambiar estado del empleado
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) {
        return res.status(400).json({
          error: 'Estado inválido. Debe ser: ACTIVE, INACTIVE, SUSPENDED o TERMINATED',
        });
      }

      const employee = await prisma.employee.findUnique({
        where: { id },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
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

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error updating employee status:', error);
      return res.status(500).json({
        error: 'Error al actualizar el estado del empleado.',
        details: error.message,
      });
    }
  }

  // Obtener resumen de empleados por compañía
  async getCompanySummary(req: Request, res: Response) {
    try {
      const { companyId } = req.params;

      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return res.status(404).json({ error: 'Compañía no encontrada.' });
      }

      const employees = await prisma.employee.findMany({
        where: { companyId },
      });

      const activeEmployees = employees.filter((e) => e.status === 'ACTIVE').length;
      const totalSalary = employees.reduce((sum, e) => sum + Number(e.salary), 0);
      const averageSalary = employees.length > 0 ? totalSalary / employees.length : 0;

      return res.status(200).json({
        companyId,
        companyName: company.name,
        totalEmployees: employees.length,
        activeEmployees,
        inactiveEmployees: employees.filter((e) => e.status === 'INACTIVE').length,
        suspendedEmployees: employees.filter((e) => e.status === 'SUSPENDED').length,
        terminatedEmployees: employees.filter((e) => e.status === 'TERMINATED').length,
        totalSalary,
        averageSalary,
        employees,
      });
    } catch (error: any) {
      console.error('Error fetching company summary:', error);
      return res.status(500).json({
        error: 'Error al obtener resumen de empleados.',
        details: error.message,
      });
    }
  }
}