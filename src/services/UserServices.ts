// src/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import { User, UserRole } from '../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';

export class UserServices {

  async login(email: string, password_plain: string): Promise<User> {
    // 1. Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    return user;
  }
    async create(username: string, email: string, password_plain: string, role: UserRole, companyId?: string): Promise<User> {
        const hashedPassword = await bcrypt.hash(password_plain, 10);
        try {
            const newUser = await prisma.user.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    role,
                    // Vincular a empresa vía UserCompany si se provee companyId
                    ...(companyId && {
                        companies: {
                            create: { companyId }
                        }
                    }),
                },
            });
            return newUser;
        } catch (error) {
            throw new Error('Error al registrar el usuario.');
        }
    }
}