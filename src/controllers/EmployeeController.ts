import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import XLSX from 'xlsx';

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

    async importFromExcel(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo Excel.' });
      }

      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: 'Se requiere companyId.' });
      }

      // Verificar que la compañía exista
      const companyExists = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!companyExists) {
        return res.status(404).json({ error: 'Compañía no encontrada.' });
      }

      // Leer el archivo Excel
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        return res.status(400).json({ error: 'El archivo Excel está vacío.' });
      }

      // Validar y mapear los datos
      const employees: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        const rowNumber = i + 2; // Fila en el Excel (comenzando desde 2)

        try {
          // Validaciones
          if (!row['Cédula'] || !row['Nombre'] || !row['Apellido']) {
            errors.push({
              fila: rowNumber,
              error: 'Cédula, Nombre y Apellido son obligatorios.',
            });
            continue;
          }

          // Validar formato de email si existe
          if (row['Email'] && !this.isValidEmail(row['Email'])) {
            errors.push({
              fila: rowNumber,
              error: `Email inválido: ${row['Email']}`,
            });
            continue;
          }

          employees.push({
            cedula: String(row['Cédula']).trim(),
            firstName: String(row['Nombre']).trim(),
            lastName: String(row['Apellido']).trim(),
            email: row['Email'] ? String(row['Email']).trim().toLowerCase() : null,
            phoneNumber: row['Teléfono'] ? String(row['Teléfono']).trim() : null,
            position: row['Posición'] ? String(row['Posición']).trim() : null,
            department: row['Departamento'] ? String(row['Departamento']).trim() : null,
            hireDate: row['Fecha de Contratación']
              ? this.excelDateToJSDate(row['Fecha de Contratación'])
              : new Date(),
            salary: row['Salario'] ? Number(row['Salario']) : 0,
            salaryType: row['Tipo de Salario'] ? String(row['Tipo de Salario']).trim() : 'MONTHLY',
            bankAccount: row['Cuenta Bancaria'] ? String(row['Cuenta Bancaria']).trim() : '',
            bankName: row['Banco'] ? String(row['Banco']).trim() : '',
            companyId,
            status: 'ACTIVE',
          });
        } catch (error: any) {
          errors.push({
            fila: rowNumber,
            error: error.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        totalRows: jsonData.length,
        validEmployees: employees.length,
        errors,
        employees,
      });
    } catch (error: any) {
      console.error('Error importing employees from Excel:', error);
      return res.status(500).json({
        error: 'Error al procesar el archivo Excel.',
        details: error.message,
      });
    }
  }

  // Confirmar importación de empleados
  async confirmImport(req: Request, res: Response) {
    try {
      const { employees, companyId } = req.body;

      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ error: 'No hay empleados para importar.' });
      }

      if (!companyId) {
        return res.status(400).json({ error: 'Se requiere companyId.' });
      }

      const createdEmployees: any[] = [];
      const failedEmployees: any[] = [];

      for (const employeeData of employees) {
        try {
          const newEmployee = await prisma.employee.create({
            data: {
              ...employeeData,
              companyId,
            },
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

          createdEmployees.push(newEmployee);
        } catch (error: any) {
          if (error.code === 'P2002') {
            failedEmployees.push({
              cedula: employeeData.cedula,
              nombre: `${employeeData.firstName} ${employeeData.lastName}`,
              error: 'La cédula o email ya existen en la base de datos.',
            });
          } else {
            failedEmployees.push({
              cedula: employeeData.cedula,
              nombre: `${employeeData.firstName} ${employeeData.lastName}`,
              error: error.message,
            });
          }
        }
      }

      return res.status(201).json({
        success: true,
        totalImported: createdEmployees.length,
        totalFailed: failedEmployees.length,
        createdEmployees,
        failedEmployees,
      });
    } catch (error: any) {
      console.error('Error confirming import:', error);
      return res.status(500).json({
        error: 'Error al confirmar la importación.',
        details: error.message,
      });
    }
  }

  // Descargar template Excel
  async downloadTemplate(req: Request, res: Response) {
    try {
      const templateData = [
        {
          'Cédula': '1234567890',
          'Nombre': 'Juan',
          'Apellido': 'Pérez',
          'Email': 'juan.perez@example.com',
          'Teléfono': '+507 1234-5678',
          'Posición': 'Ingeniero de Software',
          'Departamento': 'Tecnología',
          'Fecha de Contratación': new Date('2024-01-15'),
          'Salario': 3500,
          'Tipo de Salario': 'MONTHLY',
          'Cuenta Bancaria': '12345678901234',
          'Banco': 'Banco General',
        },
        {
          'Cédula': '9876543210',
          'Nombre': 'María',
          'Apellido': 'García',
          'Email': 'maria.garcia@example.com',
          'Teléfono': '+507 9876-5432',
          'Posición': 'Diseñadora Gráfica',
          'Departamento': 'Diseño',
          'Fecha de Contratación': new Date('2024-02-20'),
          'Salario': 2800,
          'Tipo de Salario': 'MONTHLY',
          'Cuenta Bancaria': '98765432109876',
          'Banco': 'Banco Nacional',
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados');

      // Ajustar ancho de columnas
      const columnWidths = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 18 },
        { wch: 15 },
      ];
      worksheet['!cols'] = columnWidths;

      // Generar buffer
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Disposition', 'attachment; filename="template_empleados.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error: any) {
      console.error('Error downloading template:', error);
      return res.status(500).json({
        error: 'Error al descargar el template.',
        details: error.message,
      });
    }
  }

  // Validar email
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Convertir fecha de Excel a JavaScript Date
  private excelDateToJSDate(excelDate: any): Date {
    if (typeof excelDate === 'number') {
      // Excel date serial number
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date;
    }
    return new Date(excelDate);
  }
}