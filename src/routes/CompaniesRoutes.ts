// src/companies/company.routes.ts
import { Router } from 'express';
import { CompanyController } from '../controllers/CompaniesController.js';

const CompaniesRouter = Router();
const companyController = new CompanyController();

// POST routes (específicas)
CompaniesRouter.post('/create', companyController.Create.bind(companyController));
CompaniesRouter.post('/:id/disassociate-users', companyController.disassociateUsers.bind(companyController));

// GET routes (específicas primero)
CompaniesRouter.get('/all', companyController.getAll.bind(companyController));
CompaniesRouter.get('/:id/my-companies', companyController.getMyCompanies.bind(companyController));

// ✅ RUTA ESPECÍFICA PARA DEPARTAMENTOS (debe ir ANTES de /:id)
CompaniesRouter.get('/departments/by-code/:companyCode', companyController.getDepartmentsByCompanyCode.bind(companyController));

// GET routes (genéricas al final)
CompaniesRouter.get('/:id', companyController.get.bind(companyController));

// PUT routes
CompaniesRouter.put('/:id', companyController.Edit.bind(companyController));

// DELETE routes
CompaniesRouter.delete('/:id', companyController.Delete.bind(companyController));

export default CompaniesRouter;