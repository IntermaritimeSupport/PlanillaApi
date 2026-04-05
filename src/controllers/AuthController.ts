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
      // Primera empresa asociada al usuario (la usamos como contexto por defecto)
      const primaryCompanyId = user.companies?.[0]?.companyId ?? null;

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.role ?? 'USER',
          companyId: primaryCompanyId,
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

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    try {
      await this.authService.forgotPassword(email);
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    } catch (error: any) {
      console.error('forgotPassword error:', error.message);
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }
  }

  async resetPassword(req: Request, res: Response) {
    const { email, code, newPassword } = req.body;
    try {
      await this.authService.resetPassword(email, code, newPassword);
      return res.json({ message: 'Password updated successfully.' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to reset password.' });
    }
  }

  async postRegister(req: Request, res: Response) {
    const { username, email, password, role, companyId } = req.body;
    try {
      const newUser = await this.authService.register(username, email, password, role, companyId);
      return res.status(201).json({
        message: `Usuario ${newUser.username} registrado exitosamente.`,
        user: newUser
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message || 'Error al registrar usuario'
      });
    }
  }
}
