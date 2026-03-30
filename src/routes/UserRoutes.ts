// src/users/user.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/UsersController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';
import { requireRole } from '../middlewares/authGuards.js';
import { requireActiveCompany } from '../middlewares/authGuards.js';

const userController = new UserController();
const UserRouter = Router();

UserRouter.use(verifyJWT);

UserRouter.post('/create', userController.Create);
UserRouter.delete('/delete/:id', requireRole(['SUPER_ADMIN','GLOBAL_ADMIN']), userController.Delete.bind(userController));
UserRouter.put('/edit/:id', userController.Edit.bind(userController));
UserRouter.get('/getAll', userController.getAll.bind(userController));
UserRouter.get('/profile/:id', userController.getProfile.bind(userController));
UserRouter.get('/full', userController.getAllWithPerson.bind(userController));
UserRouter.get('/full/:companyCode', requireActiveCompany, userController.getAllUserByCompanyId.bind(userController));
UserRouter.get('/my-license', userController.getMyLicense.bind(userController));
UserRouter.post('/my-companies', userController.createMyCompany.bind(userController));

export default UserRouter;