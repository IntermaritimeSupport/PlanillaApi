import { Router } from 'express';
import { EmployeeController } from '../controllers/EmployeeController.js';

const EmployeeRouter = Router();
const employeeController = new EmployeeController();

// ============================================
// EMPLOYEE ROUTES
// ============================================

/**
 * POST /api/payroll/employees
 * Crear un nuevo empleado
 * 
 * Body:
 * {
 *   cedula: string (único, obligatorio)
 *   firstName: string (obligatorio)
 *   lastName: string (obligatorio)
 *   email: string (único, obligatorio)
 *   phoneNumber?: string
 *   position: string (obligatorio)
 *   department?: string
 *   hireDate: string (ISO format, obligatorio)
 *   salary: number (obligatorio)
 *   salaryType?: 'MONTHLY' | 'BIWEEKLY' (default: MONTHLY)
 *   bankAccount?: string
 *   bankName?: string
 *   userId?: string (OPCIONAL - si no se proporciona, no se asigna usuario)
 *   companyId: string (debe existir, obligatorio)
 * }
 * 
 * Nota: Si userId se proporciona:
 * - El usuario debe existir
 * - El usuario NO debe estar asignado a otro empleado
 */
EmployeeRouter.post('/employees', (req, res) =>
  employeeController.create(req, res)
);

/**
 * GET /api/payroll/employees
 * Obtener todos los empleados (con filtros opcionales)
 * 
 * Query params:
 * - companyId?: string
 * - status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED'
 */
EmployeeRouter.get('/employees', (req, res) =>
  employeeController.getAll(req, res)
);

/**
 * GET /api/payroll/employees/:id
 * Obtener empleado específico con todo su historial
 */
EmployeeRouter.get('/employees/:id', (req, res) =>
  employeeController.getById(req, res)
);

/**
 * PUT /api/payroll/employees/:id
 * Actualizar empleado
 * 
 * Body: cualquier campo a actualizar (todos opcionales)
 */
EmployeeRouter.put('/employees/:id', (req, res) =>
  employeeController.update(req, res)
);

/**
 * DELETE /api/payroll/employees/:id
 * Eliminar empleado
 */
EmployeeRouter.delete('/employees/:id', (req, res) =>
  employeeController.delete(req, res)
);

/**
 * PUT /api/payroll/employees/:id/status
 * Cambiar estado del empleado
 * 
 * Body:
 * {
 *   status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED'
 * }
 */
EmployeeRouter.put('/employees/:id/status', (req, res) =>
  employeeController.updateStatus(req, res)
);

/**
 * GET /api/payroll/employees/company/:companyId/summary
 * Obtener resumen de empleados por compañía
 * 
 * Retorna:
 * - totalEmployees
 * - activeEmployees
 * - inactiveEmployees
 * - suspendedEmployees
 * - terminatedEmployees
 * - totalSalary
 * - averageSalary
 * - employees (lista completa)
 */
EmployeeRouter.get('/employees/company/:companyId/summary', (req, res) =>
  employeeController.getCompanySummary(req, res)
);

export default EmployeeRouter;