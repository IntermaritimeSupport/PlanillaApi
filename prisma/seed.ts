import 'dotenv/config'
import prisma from '../lib/prisma.js'
import { hash } from 'bcryptjs'
import { LegalParameterKey } from '../generated/prisma/index.js'
import { AdminConfig } from '../src/config/adminConfig.js'


export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

async function generateNextCompanyCode(): Promise<string> {
  const companies = await prisma.company.findMany({
    select: { code: true },
    orderBy: { code: 'desc' },
  })
  let max = 0
  for (const c of companies) {
    if (c.code?.startsWith('CO')) {
      const n = parseInt(c.code.replace('CO', ''), 10)
      if (!isNaN(n)) max = Math.max(max, n)
    }
  }
  return `CO${String(max + 1).padStart(3, '0')}`
}

async function generateNextUserCode(): Promise<string> {
  const persons = await prisma.person.findMany({
    select: { userCode: true },
    orderBy: { userCode: 'desc' },
  })
  let max = 0
  for (const p of persons) {
    if (p.userCode?.startsWith('USR')) {
      const n = parseInt(p.userCode.replace('USR', ''), 10)
      if (!isNaN(n)) max = Math.max(max, n)
    }
  }
  return `USR${String(max + 1).padStart(3, '0')}`
}

async function main() {
  console.log('🗑️ Limpiando base de datos...')
  
  await prisma.userCompany.deleteMany({})
  await prisma.legalParameter.deleteMany({})
  await prisma.attendanceRecord.deleteMany({})
  await prisma.payroll.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.person.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.department.deleteMany({})
  await prisma.company.deleteMany({})

  console.log('✅ Base de datos limpia.\n')

  if (!AdminConfig?.Email || !AdminConfig?.Password ) {
    throw new Error('ADMIN_EMAIL y ADMIN_EMAIL_PASSWORD deben estar definidos en las variables de entorno.')
  }

  const passwordHash = await hash(String(AdminConfig?.Email), 10)

  console.log('🏢 Creando compañía principal...')
  const companyIM = await prisma.company.create({
    data: {
      name: 'Intermaritime',
      code: await generateNextCompanyCode(),
      isActive: true,
      ruc: '8-888-8888 DV 88',
      email: 'info@intermaritime.org'
    }
  })
  console.log('📋 Creando parámetros legales para ' + companyIM.name)

  const legalParameters: any[] = [
    {
      key: LegalParameterKey.ss_empleado,
      name: 'Seguro Social - Empleado',
      type: 'employee',
      category: 'social_security',
      percentage: 9.75,
      companyId: companyIM.id,
      description: 'Cuota regular de SS para empleados',
    },
    {
      key: LegalParameterKey.ss_patrono,
      name: 'Seguro Social - Patrono',
      type: 'employer',
      category: 'social_security',
      percentage: 12.25,
      companyId: companyIM.id,
      description: 'Cuota patronal de SS',
    },
    {
      key: LegalParameterKey.ss_decimo,
      name: 'Seguro Social - XIII Mes',
      type: 'employee',
      category: 'social_security',
      percentage: 7.25,
      companyId: companyIM.id,
      description: 'Cuota de SS para el décimo tercer mes',
    },
    {
      key: LegalParameterKey.se_empleado,
      name: 'Seguro Educativo - Empleado',
      type: 'employee',
      category: 'educational_insurance',
      percentage: 1.25,
      companyId: companyIM.id,
      description: 'Seguro educativo empleado',
    },
    {
      key: LegalParameterKey.se_patrono,
      name: 'Seguro Educativo - Patrono',
      type: 'employer',
      category: 'educational_insurance',
      percentage: 1.50,
      companyId: companyIM.id,
      description: 'Seguro educativo patronal',
    },
    {
      key: LegalParameterKey.riesgo_profesional,
      name: 'Riesgos Profesionales',
      type: 'employer',
      category: 'other',
      percentage: 0.98,
      companyId: companyIM.id,
      description: 'Riesgos profesionales base',
    },
    {
      key: LegalParameterKey.isr_r1,
      name: 'ISR Tramo 1 (Exento)',
      type: 'fixed',
      category: 'isr',
      percentage: 0,
      minRange: 0,
      maxRange: 11000,
      companyId: companyIM.id,
      description: 'Rango exento hasta $11,000 anuales',
    },
    {
      key: LegalParameterKey.isr_r2,
      name: 'ISR Tramo 2 (15%)',
      type: 'fixed',
      category: 'isr',
      percentage: 15,
      minRange: 11000,
      maxRange: 50000,
      companyId: companyIM.id,
      description: '15% sobre excedente de $11k a $50k',
    },
    {
      key: LegalParameterKey.isr_r3,
      name: 'ISR Tramo 3 (25%)',
      type: 'fixed',
      category: 'isr',
      percentage: 25,
      minRange: 50000,
      maxRange: 99999999,
      companyId: companyIM.id,
      description: '25% sobre excedente de $50k',
    },
  ]

  for (const param of legalParameters) {
    await prisma.legalParameter.create({
      data: { 
        ...param, 
        status: 'active', 
        effectiveDate: new Date() 
      },
    })
  }

  /* ============================
     3. DEPARTAMENTOS
  ============================ */
  const deptAdmin = await prisma.department.create({
    data: {
      name: 'Administración',
      companyId: companyIM.id,
      isActive: true,
    }
  })

  /* ============================
     4. SUPER ADMIN
  ============================ */
  console.log('👨‍💼 Creando SUPER_ADMIN...')
  const superAdminEmail = String(AdminConfig?.Email)
  const userCode = await generateNextUserCode()

  const superAdmin = await prisma.user.create({
    data: {
      email: superAdminEmail,
      username: 'superadmin',
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      person: {
        create: {
          firstName: AdminConfig?.Name || 'Carlos',
          lastName: AdminConfig?.LastName || 'Sanchez',
          fullName: `${AdminConfig?.Name || 'Carlos'} ${AdminConfig?.LastName || 'Sanchez'}`,
          contactEmail: superAdminEmail,
          status: 'Activo',
          userCode,
          departmentId: deptAdmin.id,
          companyId: companyIM.id,
        },
      },
    }
  })

  await prisma.userCompany.create({
    data: {
      userId: superAdmin.id,
      companyId: companyIM.id,
    }
  })

  console.log('\n🎉 Seed ejecutado con éxito.')
}

main()
  .catch(err => {
    console.error('❌ Error en seed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })