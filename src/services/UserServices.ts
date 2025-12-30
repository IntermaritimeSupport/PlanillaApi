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
        // 1. Hashear la contraseña antes de almacenarla
        const hashedPassword = await bcrypt.hash(password_plain, 10);
    
        try {
        // 2. Crear el usuario en la base de datos
        const newUser = await prisma.user.create({
            data: {
            username,
            email,
            password: hashedPassword,
            role,
            companyId,
            },
        });
    
        return newUser;
        } catch (error) {
        throw new Error('Error al registrar el usuario.');
        }
    }
}