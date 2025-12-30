// src/auth/auth.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/UsersController.js';

const userController = new UserController();
const UserRouter = Router();

UserRouter.post('/create', userController.Create);
UserRouter.delete('/delete/:id', userController.Delete.bind(userController));
UserRouter.put('/edit/:id', userController.Edit.bind(userController));
UserRouter.get('/getAll', userController.getAll.bind(userController));
UserRouter.get('/profile/:id', userController.getProfile.bind(userController));
UserRouter.get('/full', userController.getAllWithPerson.bind(userController));
UserRouter.get('/full/:companyCode', userController.getAllUserByCompanyId.bind(userController));


export default UserRouter;