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
AdminRouter.get('/companies/:id', adminController.getCompany.bind(adminController));
AdminRouter.post('/companies', adminController.createCompany.bind(adminController));
AdminRouter.put('/companies/:id', adminController.updateCompany.bind(adminController));
AdminRouter.patch('/companies/:id/toggle', adminController.toggleCompany.bind(adminController));
AdminRouter.post('/companies/:id/super-admin', adminController.assignSuperAdmin.bind(adminController));
AdminRouter.post('/companies/:id/super-admin-assign', adminController.assignExistingUser.bind(adminController));
AdminRouter.get('/users',          adminController.getUsers.bind(adminController));
AdminRouter.post('/users',         adminController.createUser.bind(adminController));
AdminRouter.get('/users/search',   adminController.searchUserByEmail.bind(adminController));
AdminRouter.get('/users/:id',      adminController.getUser.bind(adminController));
AdminRouter.put('/users/:id',      adminController.updateUser.bind(adminController));
AdminRouter.delete('/users/:id',   adminController.deleteUser.bind(adminController));
AdminRouter.delete('/companies/:id', adminController.deleteCompany.bind(adminController));
AdminRouter.get('/licenses',                    adminController.getLicenses.bind(adminController));
AdminRouter.post('/licenses/check-expired',     adminController.checkExpiredLicenses.bind(adminController));
AdminRouter.put('/licenses/:userId',            adminController.upsertLicense.bind(adminController));

export default AdminRouter;
