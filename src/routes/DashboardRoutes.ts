import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const dashboardController = new DashboardController();
const DashboardRouter = Router();

DashboardRouter.use(verifyJWT);

/**
 * @route GET /api/dashboard/stats
 * @access Private
 */
DashboardRouter.get('/stats', dashboardController.getGeneralStats.bind(dashboardController));

/**
 * @route GET /api/dashboard/recent-payrolls
 * @access Private
 */
DashboardRouter.get('/recent-payrolls', dashboardController.getRecentPayrolls.bind(dashboardController));

/**
 * @route GET /api/dashboard/financial-summary
 * @access Private
 */
DashboardRouter.get('/financial-summary', dashboardController.getFinancialSummary.bind(dashboardController));

/**
 * @route GET /api/dashboard/employees-by-department
 * @access Private
 */
DashboardRouter.get('/employees-by-department', dashboardController.getEmployeesByDepartment.bind(dashboardController));

/**
 * @route GET /api/dashboard/attendance
 * @access Private
 */
DashboardRouter.get('/attendance', dashboardController.getAttendanceStats.bind(dashboardController));

/**
 * @route GET /api/dashboard/user-info
 * @access Private
 */
DashboardRouter.get('/user-info', dashboardController.getCurrentUserInfo.bind(dashboardController));

/**
 * @route GET /api/dashboard/companies
 * @access Private
 */
DashboardRouter.get('/companies', dashboardController.getUserCompanies.bind(dashboardController));

export default DashboardRouter;
