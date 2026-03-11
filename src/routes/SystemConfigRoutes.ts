import { Router } from 'express';
import { SystemConfigController } from '../controllers/SystemConfigController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const SystemRouter = Router();
const systemController = new SystemConfigController();

SystemRouter.use(verifyJWT);

// Get all configurations or filter by category
SystemRouter.get('/config', (req, res) =>
  systemController.getAll(req, res)
);

// Get specific configuration
SystemRouter.get('/config/:id', (req, res) =>
  systemController.getById(req, res)
);

// Create configuration
SystemRouter.post('/config', (req, res) =>
  systemController.create(req, res)
);

// Update configuration
SystemRouter.put('/config/:id', (req, res) =>
  systemController.update(req, res)
);

// Delete configuration
SystemRouter.delete('/config/:id', (req, res) =>
  systemController.delete(req, res)
);

export default SystemRouter;