import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController.js';
import { EmployeeController } from '../controllers/EmployeeController.js';
import { PayrollController } from '../controllers/PayrollController.js';
import { LeaveController } from '../controllers/LeaveController.js';
import { EmailController } from '../controllers/EmailController.js';
import { LiquidacionController } from '../controllers/LiquidacionController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const PayrollRouter = Router();

const employeeController = new EmployeeController();
const payrollController = new PayrollController();
const attendanceController = new AttendanceController();
const leaveController = new LeaveController();
const emailController = new EmailController();
const liquidacionController = new LiquidacionController();

PayrollRouter.use(verifyJWT);

// ============================================
// EMPLOYEE ROUTES
// ============================================

PayrollRouter.post('/employees', (req, res) => employeeController.create(req, res));
PayrollRouter.get('/employees', (req, res) => employeeController.getAll(req, res));
PayrollRouter.get('/employees/:id', (req, res) => employeeController.getById(req, res));
PayrollRouter.put('/employees/:id', (req, res) => employeeController.update(req, res));
PayrollRouter.delete('/employees/:id', (req, res) => employeeController.delete(req, res));

// ============================================
// PAYROLL ROUTES
// ============================================

PayrollRouter.post('/payrolls/generate', (req, res) => payrollController.generatePayroll(req, res));
PayrollRouter.get('/payrolls', (req, res) => payrollController.getPayrolls(req, res));
PayrollRouter.get('/payrolls/runs', (req, res) => payrollController.getPayrollRuns(req, res));
PayrollRouter.get('/payrolls/summary', (req, res) => payrollController.getPayrollSummary(req, res));
PayrollRouter.patch('/payrolls/:id/lock', (req, res) => payrollController.lockPayroll(req, res));
PayrollRouter.patch('/payrolls/:id/void', (req, res) => payrollController.voidPayroll(req, res));
PayrollRouter.get('/payrolls/:id', (req, res) => payrollController.getPayrollById(req, res));
PayrollRouter.put('/payrolls/:id/approve', (req, res) => payrollController.approvePayroll(req, res));
PayrollRouter.put('/payrolls/:id/reject', (req, res) => payrollController.rejectPayroll(req, res));

// ============================================
// ATTENDANCE ROUTES
// ============================================

PayrollRouter.post('/attendance', (req, res) => attendanceController.recordAttendance(req, res));
PayrollRouter.get('/attendance/employee/:employeeId', (req, res) => attendanceController.getAttendanceByEmployee(req, res));
PayrollRouter.get('/attendance/company/:companyId', (req, res) => attendanceController.getCompanyAttendance(req, res));
PayrollRouter.get('/attendance/summary/monthly', (req, res) => attendanceController.getMonthlyAttendanceSummary(req, res));

// ============================================
// LEAVE ROUTES
// ============================================

PayrollRouter.post('/leaves', (req, res) => leaveController.requestLeave(req, res));
PayrollRouter.get('/leaves', (req, res) => leaveController.getLeaveRequests(req, res));
PayrollRouter.put('/leaves/:id/approve', (req, res) => leaveController.approveLeave(req, res));
PayrollRouter.put('/leaves/:id/reject', (req, res) => leaveController.rejectLeave(req, res));
PayrollRouter.put('/leaves/:id/cancel', (req, res) => leaveController.cancelLeave(req, res));

// ============================================
// EMAIL ROUTES
// ============================================

PayrollRouter.post('/send-payslip', (req, res) => emailController.sendPayslip(req, res));

// ============================================
// LIQUIDACION ROUTES
// ============================================

PayrollRouter.post('/liquidaciones', (req, res) => liquidacionController.create(req, res));
PayrollRouter.get('/liquidaciones', (req, res) => liquidacionController.getAll(req, res));
PayrollRouter.post('/liquidaciones/:id/revert', (req, res) => liquidacionController.revert(req, res));

export default PayrollRouter;
