// src/routes/DecimoRoutes.ts
import { Router } from 'express';
import { DecimoController } from '../controllers/DecimoController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const DecimoRouter = Router();
const decimoController = new DecimoController();

DecimoRouter.use(verifyJWT);

/**
 * GET /api/payroll/decimo/history?companyId=&year=
 * Obtener historial de pagos del décimo tercer mes (3 partidas)
 */
DecimoRouter.get('/decimo/history', (req, res) =>
  decimoController.getHistory(req, res)
);

/**
 * POST /api/payroll/decimo/pay
 * Registrar un pago de partida del décimo
 * Body: { companyId, year, partida, totalAmount, paymentDate?, notes? }
 */
DecimoRouter.post('/decimo/pay', (req, res) =>
  decimoController.registerPayment(req, res)
);

/**
 * DELETE /api/payroll/decimo/pay/:id
 * Anular un pago de partida del décimo
 */
DecimoRouter.delete('/decimo/pay/:id', (req, res) =>
  decimoController.deletePayment(req, res)
);

export default DecimoRouter;
