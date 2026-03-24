// src/companies/company.routes.ts
import { Router } from 'express';
import { CompanyController } from '../controllers/CompaniesController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';
import { requireRole } from '../middlewares/authGuards.js';

const CompaniesRouter = Router();
const companyController = new CompanyController();

CompaniesRouter.use(verifyJWT);

// POST routes
CompaniesRouter.post('/setup', companyController.setup.bind(companyController));
CompaniesRouter.post('/create', companyController.Create.bind(companyController));
CompaniesRouter.post('/:id/disassociate-users', companyController.disassociateUsers.bind(companyController));

// GET routes (específicas primero)
CompaniesRouter.get('/all', companyController.getAll.bind(companyController));
CompaniesRouter.get('/:userId/my-companies', companyController.getMyCompanies.bind(companyController));
CompaniesRouter.get('/departments/by-code/:companyCode', companyController.getDepartmentsByCompanyCode.bind(companyController));

// GET routes (genéricas al final)
CompaniesRouter.get('/:id', companyController.get.bind(companyController));

// PUT routes
CompaniesRouter.put('/:id', companyController.Edit.bind(companyController));

// DELETE routes
CompaniesRouter.delete('/:id', requireRole(['SUPER_ADMIN','GLOBAL_ADMIN']), companyController.Delete.bind(companyController));

export default CompaniesRouter;
