/**
 * seed-global-admin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea (o actualiza) el GLOBAL_ADMIN de plataforma.
 *
 * El GLOBAL_ADMIN NO pertenece a ninguna empresa; puede ver TODAS.
 * Credenciales vienen de variables de entorno:
 *   GLOBAL_ADMIN_EMAIL    (requerido)
 *   GLOBAL_ADMIN_PASSWORD (requerido)
 *   GLOBAL_ADMIN_NAME     (opcional, default "Global")
 *   GLOBAL_ADMIN_LASTNAME (opcional, default "Admin")
 *
 * Uso:
 *   npx tsx prisma/seed-global-admin.ts
 *   (o vía package.json: "seed:admin": "tsx prisma/seed-global-admin.ts")
 */

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { hash } from 'bcryptjs';
import { UserRole } from '../generated/prisma/index.js';

async function main() {
  const email    = process.env.GLOBAL_ADMIN_EMAIL;
  const password = process.env.GLOBAL_ADMIN_PASSWORD;
  const name     = process.env.GLOBAL_ADMIN_NAME     ?? 'Global';
  const lastName = process.env.GLOBAL_ADMIN_LASTNAME ?? 'Admin';

  if (!email || !password) {
    throw new Error(
      'Variables de entorno requeridas: GLOBAL_ADMIN_EMAIL, GLOBAL_ADMIN_PASSWORD'
    );
  }

  console.log('🌐 Configurando GLOBAL_ADMIN de plataforma...');

  const passwordHash = await hash(password, 10);

  const globalAdmin = await prisma.user.upsert({
    where:  { email: email.toLowerCase() },
    update: { role: UserRole.GLOBAL_ADMIN, isActive: true },
    create: {
      email:    email.toLowerCase(),
      username: 'global_admin',
      password: passwordHash,
      role:     UserRole.GLOBAL_ADMIN,
      isActive: true,
      // NO se vincula a ninguna empresa (companies: [])
    },
  });

  // Person info (userCode único)
  const existingPerson = await prisma.person.findUnique({
    where: { userId: globalAdmin.id },
  });

  const userCode = existingPerson?.userCode ?? await generateGlobalAdminCode();

  await prisma.person.upsert({
    where:  { userId: globalAdmin.id },
    update: {},
    create: {
      userId:       globalAdmin.id,
      firstName:    name,
      lastName:     lastName,
      fullName:     `${name} ${lastName}`,
      contactEmail: email.toLowerCase(),
      userCode:     userCode,
      status:       'Activo',
      // departmentId: null — no pertenece a un depto de empresa
    },
  });

  console.log(`✅ GLOBAL_ADMIN listo:`);
  console.log(`   ID:       ${globalAdmin.id}`);
  console.log(`   Email:    ${globalAdmin.email}`);
  console.log(`   Rol:      ${globalAdmin.role}`);
  console.log(`   Empresa:  — (ninguna, acceso global)`);
}

async function generateGlobalAdminCode(): Promise<string> {
  // Reservamos el rango GA001-GA999 para admins globales
  const last = await prisma.person.findFirst({
    where:   { userCode: { startsWith: 'GA' } },
    orderBy: { userCode: 'desc' },
  });
  const max = last?.userCode?.startsWith('GA')
    ? parseInt(last.userCode.replace('GA', ''), 10)
    : 0;
  return `GA${String(max + 1).padStart(3, '0')}`;
}

main()
  .catch((err) => {
    console.error('❌ Error en seed-global-admin:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
