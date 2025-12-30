
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma.js';

export async function createSuperAdminSeed() {
  const passwordHash = await bcrypt.hash('SuperAdmin123!', 10);

  const existing = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        username: 'superadmin',
        email: 'superadmin@example.com',
        password: passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    return { success: true, message: 'Usuario SUPER_ADMIN creado.' };
  }

  return { success: false, message: 'Ya existe un SUPER_ADMIN.' };
}
