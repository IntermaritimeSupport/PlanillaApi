// ─────────────────────────────────────────────────────────────────────────────
// VoucherRoutes.ts
// Rutas para envío de comprobantes de pago por email
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { VoucherController } from '../controllers/VoucherController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const VoucherRouter = Router();
const voucherController = new VoucherController();

VoucherRouter.use(verifyJWT);

/**
 * POST /api/payroll/voucher/send
 * Envía el comprobante de pago a un empleado específico
 * Body: { payrollId: string }
 */
VoucherRouter.post('/voucher/send', (req, res) =>
  voucherController.sendSingle(req, res)
);

/**
 * POST /api/payroll/voucher/send-bulk
 * Envía comprobantes a todos los empleados de un lote
 * Body: { payrollRunId?: string } | { payrollIds?: string[] } | { companyId?: string }
 */
VoucherRouter.post('/voucher/send-bulk', (req, res) =>
  voucherController.sendBulk(req, res)
);

/**
 * GET /api/payroll/voucher/preview/:payrollId
 * Descarga directa del PDF del comprobante (sin enviar email)
 */
VoucherRouter.get('/voucher/preview/:payrollId', (req, res) =>
  voucherController.previewPDF(req, res)
);

export default VoucherRouter;
