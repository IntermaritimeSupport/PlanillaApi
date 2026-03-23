// src/departments/department.routes.ts
import { Router } from 'express';
import { DepartmentController } from '../controllers/DepartmentController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';
import { requireActiveCompany } from '../middlewares/authGuards.js';

const DepartmentRouter = Router();
const departmentController = new DepartmentController();

DepartmentRouter.use(verifyJWT);
DepartmentRouter.use(requireActiveCompany);

DepartmentRouter.post('/create', departmentController.Create.bind(departmentController));
DepartmentRouter.get('/all', departmentController.getAll.bind(departmentController));
DepartmentRouter.get('/:id', departmentController.get.bind(departmentController));
DepartmentRouter.put('/:id', departmentController.Edit.bind(departmentController));
DepartmentRouter.delete('/:id', departmentController.Delete.bind(departmentController));

export default DepartmentRouter;