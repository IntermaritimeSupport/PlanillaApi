// src/auth/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/AuthServices.js';
import jwt from 'jsonwebtoken';

export class AuthController {
  constructor(private authService: AuthService) {}

  async postLogin(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
      const user = await this.authService.login(email, password);

      // Leído dentro del método para que dotenv ya haya cargado
      const secret = process.env.JWT_SECRET!;
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.role ?? 'user',
        },
        secret,
        { expiresIn: '30d' }
      );
      return res.json({ token });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Credenciales inválidas';
      return res.status(401).json({ message });
    }
  }

  async postLogout(_req: Request, res: Response) {
    return res.json({
      message: 'Has cerrado sesión. El token debe ser eliminado en el cliente.',
    });
  }

  async postRegister(req: Request, res: Response) {
    const { username, email, password, role, companyId } = req.body;
    try {
      const newUser = await this.authService.register(username, email, password, role, companyId);
      return res.status(201).json({
        message: `Usuario ${newUser.username} registrado exitosamente.`,
        user: newUser,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al registrar usuario';
      return res.status(400).json({ message });
    }
  }
}
