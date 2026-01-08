import 'dotenv/config'
import prisma from '../lib/prisma.js'
import { hash } from 'bcryptjs'
import { LegalParameterKey, UserRole } from '../generated/prisma/index.js'
import { AdminConfig } from '../src/config/adminConfig.js'

async function main() {
  console.log('🌱 Iniciando actualización de base de datos (Modo Idempotente)...')

  if (!AdminConfig?.Email || !AdminConfig?.Password) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar definidos en el entorno.')
  }

  /* ============================
     1. COMPAÑÍA PRINCIPAL
  ============================ */
  const existingCompany = await prisma.company.findUnique({ where: { name: 'Intermaritime' } })
  const companyCode = existingCompany?.code || await generateNextCompanyCode()

  const companyIM = await prisma.company.upsert({
    where: { name: 'Intermaritime' },
    update: {
      ruc: '8-888-8888 DV 88',
      email: 'info@intermaritime.org',
      isActive: true
    },
    create: {
      name: 'Intermaritime',
      code: companyCode,
      isActive: true,
      ruc: '8-888-8888 DV 88',
      email: 'info@intermaritime.org'
    }
  })
  console.log(`🏢 Compañía: ${companyIM.name} [OK]`)

  /* ============================
     2. PARÁMETROS LEGALES (REGULARES Y DÉCIMO)
  ============================ */
  const paramsData = [
    { key: LegalParameterKey.ss_empleado, name: 'Seguro Social - Empleado', type: 'employee', category: 'social_security', percentage: 9.75, description: 'Cuota regular de SS para empleados' },
    { key: LegalParameterKey.ss_patrono, name: 'Seguro Social - Patrono', type: 'employer', category: 'social_security', percentage: 12.25, description: 'Cuota patronal de SS' },
    { key: LegalParameterKey.ss_decimo, name: 'Seguro Social - XIII Mes', type: 'employee', category: 'social_security', percentage: 7.25, description: 'Cuota de SS para el décimo tercer mes' },
    { key: LegalParameterKey.se_empleado, name: 'Seguro Educativo - Empleado', type: 'employee', category: 'educational_insurance', percentage: 1.25, description: 'Seguro educativo empleado' },
    { key: LegalParameterKey.se_patrono, name: 'Seguro Educativo - Patrono', type: 'employer', category: 'educational_insurance', percentage: 1.50, description: 'Seguro educativo patronal' },
    { key: LegalParameterKey.riesgo_profesional, name: 'Riesgos Profesionales', type: 'employer', category: 'other', percentage: 0.98, description: 'Riesgos profesionales base' },
    { key: LegalParameterKey.isr_r1, name: 'ISR Tramo 1 (Exento)', type: 'fixed', category: 'isr', percentage: 0, minRange: 0, maxRange: 11000, description: 'Rango exento hasta $11,000 anuales' },
    { key: LegalParameterKey.isr_r2, name: 'ISR Tramo 2 (15%)', type: 'fixed', category: 'isr', percentage: 15, minRange: 11001, maxRange: 50000, description: '15% sobre excedente de $11k a $50k' },
    { key: LegalParameterKey.isr_r3, name: 'ISR Tramo 3 (25%)', type: 'fixed', category: 'isr', percentage: 25, minRange: 50001, maxRange: 99999999, description: '25% sobre excedente de $50k' },
  ]

  for (const p of paramsData) {
    // Upsert para LegalParameter
    await prisma.legalParameter.upsert({
      where: { companyId_key: { companyId: companyIM.id, key: p.key } },
      update: { percentage: p.percentage, minRange: p.minRange, maxRange: p.maxRange, name: p.name },
      create: { ...p, companyId: companyIM.id, status: 'active', effectiveDate: new Date() }
    })

    // Upsert para LegalDecimoParameter
    await prisma.legalDecimoParameter.upsert({
      where: { companyId_key: { companyId: companyIM.id, key: p.key } },
      update: { percentage: p.percentage, minRange: p.minRange, maxRange: p.maxRange, name: p.name },
      create: { ...p, companyId: companyIM.id, status: 'active', effectiveDate: new Date() }
    })
  }
  console.log('📋 Parámetros legales (Regulares y Décimo) actualizados.')

  /* ============================
     3. DEPARTAMENTO
  ============================ */
  // NOTA: Para este upsert necesitas @@unique([name, companyId]) en tu esquema de Department
  const deptAdmin = await prisma.department.upsert({
    where: { id: (await prisma.department.findFirst({ where: { name: 'Administración', companyId: companyIM.id } }))?.id || '00000000-0000-0000-0000-000000000000' },
    update: { isActive: true },
    create: {
      name: 'Administración',
      companyId: companyIM.id,
      isActive: true,
    }
  })

  /* ============================
     4. SUPER ADMIN
  ============================ */
  const superAdminEmail = String(AdminConfig?.Email).toLowerCase()
  const passwordHash = await hash(String(AdminConfig?.Password), 10)

  // Primero el usuario
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { role: UserRole.SUPER_ADMIN, isActive: true },
    create: {
      email: superAdminEmail,
      username: 'superadmin',
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    }
  })

  // Luego su información de persona y códigos
  const existingPerson = await prisma.person.findUnique({ where: { userId: superAdmin.id } })
  const userCode = existingPerson?.userCode || await generateNextUserCode()

  await prisma.person.upsert({
    where: { userId: superAdmin.id },
    update: { departmentId: deptAdmin.id, companyId: companyIM.id },
    create: {
      userId: superAdmin.id,
      firstName: AdminConfig?.Name || 'Admin',
      lastName: AdminConfig?.LastName || 'Sistema',
      fullName: `${AdminConfig?.Name || 'Admin'} ${AdminConfig?.LastName || 'Sistema'}`,
      contactEmail: superAdminEmail,
      userCode: userCode,
      departmentId: deptAdmin.id,
      companyId: companyIM.id,
      status: 'Activo'
    }
  })

  // Relación Usuario-Compañía
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: superAdmin.id, companyId: companyIM.id } },
    update: {},
    create: { userId: superAdmin.id, companyId: companyIM.id }
  })

  console.log('👨‍💼 Super Admin configurado.')
  console.log('\n🎉 Seed finalizado con éxito.')
}

/* ============================
   HELPERS
============================ */
async function generateNextCompanyCode(): Promise<string> {
  const last = await prisma.company.findFirst({ orderBy: { code: 'desc' } })
  const max = last?.code?.startsWith('CO') ? parseInt(last.code.replace('CO', ''), 10) : 0
  return `CO${String(max + 1).padStart(3, '0')}`
}

async function generateNextUserCode(): Promise<string> {
  const last = await prisma.person.findFirst({ orderBy: { userCode: 'desc' } })
  const max = last?.userCode?.startsWith('USR') ? parseInt(last.userCode.replace('USR', ''), 10) : 0
  return `USR${String(max + 1).padStart(3, '0')}`
}

main()
  .catch(err => {
    console.error('❌ Error en seed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })