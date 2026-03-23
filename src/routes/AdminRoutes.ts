import { Router } from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';
import { requireRole } from '../middlewares/authGuards.js';

const adminController = new AdminController();
const AdminRouter = Router();

// Todas las rutas requieren JWT + rol GLOBAL_ADMIN
AdminRouter.use(verifyJWT);
AdminRouter.use(requireRole(['GLOBAL_ADMIN']));

AdminRouter.get('/stats',    adminController.getStats.bind(adminController));
AdminRouter.get('/companies', adminController.getCompanies.bind(adminController));
AdminRouter.post('/companies', adminController.createCompany.bind(adminController));
AdminRouter.patch('/companies/:id/toggle', adminController.toggleCompany.bind(adminController));
AdminRouter.post('/companies/:id/super-admin', adminController.assignSuperAdmin.bind(adminController));
AdminRouter.get('/users',    adminController.getUsers.bind(adminController));
AdminRouter.get('/licenses', adminController.getLicenses.bind(adminController));

export default AdminRouter;
