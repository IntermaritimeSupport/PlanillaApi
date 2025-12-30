import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController.js';
import { EmployeeController } from '../controllers/EmployeeController.js';
import { PayrollController } from '../controllers/PayrollController.js';
import { LeaveController } from '../controllers/LeaveController.js';


const PayrollRouter = Router();

const employeeController = new EmployeeController();
const payrollController = new PayrollController();
const attendanceController = new AttendanceController();
const leaveController = new LeaveController();

// ============================================
// EMPLOYEE ROUTES
// ============================================

// Crear nuevo empleado
PayrollRouter.post('/employees', (req, res) =>
  employeeController.create(req, res)
);

// Obtener todos los empleados (con filtro opcional por compañía)
PayrollRouter.get('/employees', (req, res) =>
  employeeController.getAll(req, res)
);

// Obtener empleado por ID
PayrollRouter.get('/employees/:id', (req, res) =>
  employeeController.getById(req, res)
);

// Actualizar empleado
PayrollRouter.put('/employees/:id', (req, res) =>
  employeeController.update(req, res)
);

// Eliminar empleado
PayrollRouter.delete('/employees/:id', (req, res) =>
  employeeController.delete(req, res)
);

// ============================================
// PAYROLL ROUTES
// ============================================

// Generar nómina
PayrollRouter.post('/payrolls/generate', (req, res) =>
  payrollController.generatePayroll(req, res)
);

// Obtener nóminas (con filtros)
PayrollRouter.get('/payrolls', (req, res) =>
  payrollController.getPayrolls(req, res)
);

// Obtener nómina por ID
PayrollRouter.get('/payrolls/:id', (req, res) =>
  payrollController.getPayrollById(req, res)
);

// Aprobar nómina
PayrollRouter.put('/payrolls/:id/approve', (req, res) =>
  payrollController.approvePayroll(req, res)
);

// Rechazar nómina
PayrollRouter.put('/payrolls/:id/reject', (req, res) =>
  payrollController.rejectPayroll(req, res)
);

// ============================================
// ATTENDANCE ROUTES
// ============================================

// Registrar asistencia
PayrollRouter.post('/attendance', (req, res) =>
  attendanceController.recordAttendance(req, res)
);

// Obtener asistencia por empleado
PayrollRouter.get('/attendance/employee/:employeeId', (req, res) =>
  attendanceController.getAttendanceByEmployee(req, res)
);

// Obtener asistencia de la compañía
PayrollRouter.get('/attendance/company/:companyId', (req, res) =>
  attendanceController.getCompanyAttendance(req, res)
);

// Obtener resumen mensual de asistencia
PayrollRouter.get('/attendance/summary/monthly', (req, res) =>
  attendanceController.getMonthlyAttendanceSummary(req, res)
);

// ============================================
// LEAVE ROUTES
// ============================================

// Solicitar permiso
PayrollRouter.post('/leaves', (req, res) =>
  leaveController.requestLeave(req, res)
);

// Obtener solicitudes de permiso (con filtros)
PayrollRouter.get('/leaves', (req, res) =>
  leaveController.getLeaveRequests(req, res)
);

// Aprobar solicitud de permiso
PayrollRouter.put('/leaves/:id/approve', (req, res) =>
  leaveController.approveLeave(req, res)
);

// Rechazar solicitud de permiso
PayrollRouter.put('/leaves/:id/reject', (req, res) =>
  leaveController.rejectLeave(req, res)
);

// Cancelar solicitud de permiso
PayrollRouter.put('/leaves/:id/cancel', (req, res) =>
  leaveController.cancelLeave(req, res)
);

export default PayrollRouter;