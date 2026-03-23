import { Router } from 'express';
import multer from 'multer';
import { EmployeeController } from '../controllers/EmployeeController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';
import { requireActiveCompany } from '../middlewares/authGuards.js';

const EmployeeRouter = Router();
const employeeController = new EmployeeController();

// ============================================
// MULTER CONFIGURATION
// ============================================
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

EmployeeRouter.use(verifyJWT);
EmployeeRouter.use(requireActiveCompany);

// ============================================
// EMPLOYEE ROUTES
// ============================================

EmployeeRouter.post('/employees', (req, res) => employeeController.create(req, res));
EmployeeRouter.get('/employees', (req, res) => employeeController.getAll(req, res));
EmployeeRouter.get('/employees/:id/salary-history', (req, res) => employeeController.getSalaryHistory(req, res));
EmployeeRouter.get('/employees/:id', (req, res) => employeeController.getById(req, res));
EmployeeRouter.put('/employees/:id', (req, res) => employeeController.update(req, res));
EmployeeRouter.delete('/employees/:id', (req, res) => employeeController.delete(req, res));
EmployeeRouter.put('/employees/:id/status', (req, res) => employeeController.updateStatus(req, res));
EmployeeRouter.get('/employees/company/:companyId/summary', (req, res) => employeeController.getCompanySummary(req, res));

// ============================================
// IMPORT/EXPORT ROUTES
// ============================================

EmployeeRouter.post('/employees/import/preview', upload.single('file'), (req, res) => employeeController.importFromExcel(req, res));
EmployeeRouter.post('/employees/import/confirm', (req, res) => employeeController.confirmImport(req, res));
EmployeeRouter.get('/employees/template/download', (req, res) => employeeController.downloadTemplate(req, res));

export default EmployeeRouter;
