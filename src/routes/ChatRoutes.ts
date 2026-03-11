import { Router } from 'express';
import { ChatController } from '../controllers/ChatController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const chatRouter = Router();
const controller = new ChatController();

chatRouter.use(verifyJWT);

chatRouter.post('/chat', (req, res) => controller.chat(req, res));

export default chatRouter;
