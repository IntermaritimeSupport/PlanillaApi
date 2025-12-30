// src/auth/auth.routes.ts
import { Router } from 'express';
import { isAuthenticated } from '../middlewares/AuthMiddleware'; // Importar el middleware
import { AuthController } from '../controllers/AuthController.js';
import { AuthService } from '../services/AuthServices.js';

const authService = new AuthService();
const authController = new AuthController(authService);
const AuthRouter = Router();

AuthRouter.post('/login', authController.postLogin.bind(authController));
AuthRouter.post('/logout', authController.postLogout.bind(authController));


export default AuthRouter;