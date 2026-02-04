import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController.js';


const dashboardController = new DashboardController();
const DashboardRouter = Router();
/**
 * @route GET /api/dashboard/stats
 * @desc Obtiene estadísticas generales del dashboard
 * @access Private
 */
DashboardRouter.get('/stats',dashboardController.getGeneralStats.bind(dashboardController));

/**
 * @route GET /api/dashboard/recent-payrolls
 * @desc Obtiene nóminas recientes
 * @access Private
 * @query {number} limit - Número de registros a traer (default: 10)
 * @query {string} companyId - ID de la compañía (opcional)
 */
DashboardRouter.get('/recent-payrolls',dashboardController.getRecentPayrolls.bind(dashboardController));

/**
 * @route GET /api/dashboard/financial-summary
 * @desc Obtiene resumen financiero de nóminas
 * @access Private
 * @query {string} companyId - ID de la compañía (opcional)
 * @query {string} monthYear - Formato: YYYY-MM (opcional)
 */
DashboardRouter.get('/financial-summary', dashboardController.getFinancialSummary.bind(dashboardController));

/**
 * @route GET /api/dashboard/employees-by-department
 * @desc Obtiene empleados agrupados por departamento
 * @access Private
 * @query {string} companyId - ID de la compañía (opcional)
 */
DashboardRouter.get('/employees-by-department',dashboardController.getEmployeesByDepartment.bind(dashboardController));

/**
 * @route GET /api/dashboard/attendance
 * @desc Obtiene estadísticas de asistencia
 * @access Private
 * @query {string} companyId - ID de la compañía (opcional)
 * @query {number} days - Número de días a considerar (default: 30)
 */
DashboardRouter.get('/attendance',dashboardController.getAttendanceStats.bind(dashboardController));

/**
 * @route GET /api/dashboard/user-info
 * @desc Obtiene información del usuario autenticado
 * @access Private
 */
DashboardRouter.get('/user-info',dashboardController.getCurrentUserInfo.bind(dashboardController));

/**
 * @route GET /api/dashboard/companies
 * @desc Obtiene todas las compañías del usuario
 * @access Private
 */
DashboardRouter.get('/companies',dashboardController.getUserCompanies.bind(dashboardController));

export default DashboardRouter;