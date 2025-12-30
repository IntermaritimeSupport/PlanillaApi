// src/auth/auth.routes.ts
import { Router } from 'express';
import { SeedController } from '../controllers/seedController.js';


const seedController = new SeedController();
const SeedRouter = Router();

SeedRouter.post('/seed', seedController.runSeed.bind(seedController));

export default SeedRouter;