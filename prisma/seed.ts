/**
 * seed.ts — Seed de arranque de plataforma
 * ─────────────────────────────────────────────────────────────────────────────
 * Solo crea el GLOBAL_ADMIN.
 *
 * El flujo correcto del sistema es:
 *   1. GLOBAL_ADMIN (este seed) — administrador de la plataforma
 *   2. GLOBAL_ADMIN crea empresas desde el panel /admin/companies
 *   3. GLOBAL_ADMIN crea un SUPER_ADMIN por empresa y lo vincula a ella
 *   4. SUPER_ADMIN crea ADMIN / MODERATOR / USER dentro de su empresa
 *
 * Variables requeridas en .env:
 *   GLOBAL_ADMIN_EMAIL
 *   GLOBAL_ADMIN_PASSWORD
 *   GLOBAL_ADMIN_NAME     (opcional, default "Admin")
 *   GLOBAL_ADMIN_LASTNAME (opcional, default "Global")
 */

import 'dotenv/config'
import prisma from '../lib/prisma.js'
import { hash } from 'bcryptjs'
import { UserRole } from '../generated/prisma/index.js'

async function main() {
  const email    = process.env.GLOBAL_ADMIN_EMAIL
  const password = process.env.GLOBAL_ADMIN_PASSWORD
  const name     = process.env.GLOBAL_ADMIN_NAME     ?? 'Admin'
  const lastName = process.env.GLOBAL_ADMIN_LASTNAME ?? 'Global'

  if (!email || !password) {
    throw new Error(
      '❌ Variables requeridas no definidas: GLOBAL_ADMIN_EMAIL, GLOBAL_ADMIN_PASSWORD\n' +
      '   Agrégalas en .env y vuelve a ejecutar.'
    )
  }

  console.log('🌱 Iniciando seed de plataforma...\n')

  const passwordHash = await hash(password, 10)

  const globalAdmin = await prisma.user.upsert({
    where:  { email: email.toLowerCase() },
    update: { role: UserRole.GLOBAL_ADMIN, isActive: true },
    create: {
      email:    email.toLowerCase(),
      username: 'global_admin',
      password: passwordHash,
      role:     UserRole.GLOBAL_ADMIN,
      isActive: true,
      // Sin companies[] — el GLOBAL_ADMIN no pertenece a ninguna empresa
    },
  })

  // Perfil de persona (para que aparezca correctamente en el sistema)
  const existing = await prisma.person.findUnique({ where: { userId: globalAdmin.id } })
  const userCode = existing?.userCode ?? await generateGlobalAdminCode()

  await prisma.person.upsert({
    where:  { userId: globalAdmin.id },
    update: {},
    create: {
      userId:       globalAdmin.id,
      firstName:    name,
      lastName:     lastName,
      fullName:     `${name} ${lastName}`,
      contactEmail: email.toLowerCase(),
      userCode,
      status:       'Activo',
    },
  })

  console.log('✅ GLOBAL_ADMIN configurado:')
  console.log(`   Email:   ${globalAdmin.email}`)
  console.log(`   Rol:     ${globalAdmin.role}`)
  console.log(`   Empresa: — (acceso global a todas las empresas)\n`)
  console.log('🎉 Seed finalizado.')
  console.log('')
  console.log('Próximos pasos:')
  console.log('  1. Inicia sesión con el GLOBAL_ADMIN en /login')
  console.log('  2. Ve a /admin/companies → crea las empresas')
  console.log('  3. Ve a /admin/users → crea un SUPER_ADMIN por empresa')
  console.log('  4. El SUPER_ADMIN crea sus propios usuarios desde /users')
}

async function generateGlobalAdminCode(): Promise<string> {
  const last = await prisma.person.findFirst({
    where:   { userCode: { startsWith: 'GA' } },
    orderBy: { userCode: 'desc' },
  })
  const max = last?.userCode?.startsWith('GA')
    ? parseInt(last.userCode.replace('GA', ''), 10)
    : 0
  return `GA${String(max + 1).padStart(3, '0')}`
}

main()
  .catch(err => {
    console.error('❌ Error en seed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
