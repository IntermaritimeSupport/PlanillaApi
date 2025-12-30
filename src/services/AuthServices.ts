// src/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { User, UserRole } from '../../generated/prisma/client.js';

// Tipo para la respuesta de login (sin datos sensibles)
interface LoginResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  companies: Array<{
    companyId: string;
    company: {
      id: string;
      code: string;
      name: string;
    };
  }>;
}

export class AuthService {

  async login(email: string, password_plain: string): Promise<LoginResponse> {
    // Validar entrada
    if (!email || !password_plain) {
      throw new Error('Email y contraseña son requeridos.');
    }

    // 1. Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        companies: {
          select: {
            companyId: true,
            company: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      // Mensaje genérico por seguridad (no revelar si existe el usuario)
      throw new Error('Credenciales inválidas.');
    }

    // 2. Verificar si la cuenta de usuario está activa
    if (!user.isActive) {
      throw new Error('Tu cuenta está inactiva. Por favor, contacta al administrador.');
    }

    // 3. Comparar la contraseña proporcionada con la contraseña hasheada almacenada
    const isPasswordValid = await bcrypt.compare(password_plain, user.password);

    if (!isPasswordValid) {
      throw new Error('Credenciales inválidas.');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async register(
    username: string, 
    email: string, 
    password_plain: string, 
    role: UserRole, 
    companyId?: string
  ): Promise<LoginResponse> {
    // Validar entrada
    if (!username || !email || !password_plain) {
      throw new Error('Nombre de usuario, email y contraseña son requeridos.');
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('El formato del email no es válido.');
    }

    // Validar longitud de contraseña
    if (password_plain.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }

    // 1. Hashear la contraseña antes de almacenarla
    const hashedPassword = await bcrypt.hash(password_plain, 10);

    try {
      // 2. Crear el nuevo usuario en la base de datos
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role,
          ...(companyId && {
            companies: {
              create: {
                companyId: companyId,
              },
            },
          }),
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          companies: {
            select: {
              companyId: true,
              company: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      console.log('Usuario registrado:', newUser.id);

      // 3. Devolver el usuario creado (sin la contraseña hasheada)
      return newUser;
    } catch (error: any) {
      // Manejo de errores específicos
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          throw new Error('El correo electrónico ya está registrado.');
        }
        if (error.meta?.target?.includes('username')) {
          throw new Error('El nombre de usuario ya está en uso.');
        }
      }

      console.error('Error al registrar usuario:', error.message);
      throw new Error('No se pudo registrar el usuario. Por favor, inténtalo de nuevo.');
    }
  }

  // Método útil para obtener datos del usuario sin la contraseña
  private excludePassword(user: User): Omit<User, 'password'> {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}