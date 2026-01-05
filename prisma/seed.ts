import 'dotenv/config'
import prisma from '../lib/prisma.js'
import { hash } from 'bcryptjs'

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export async function generateNextCompanyCode(): Promise<string> {
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

export async function generateNextUserCode(): Promise<string> {
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

/* ============================
   SEED
============================ */

async function main() {
  console.log('🌱 Ejecutando seed...\n')

  const passwordHash = await hash('Lexus0110', 10)

  /* ============================
     LEGAL PARAMETERS
  ============================ */
  console.log('📋 Creando parámetros legales...')

  const legalParameters = [
    {
      key: 'sss_employee',
      name: 'Aportación SSS - Empleado',
      type: 'employee',
      category: 'social_security',
      percentage: 2.87,
      description: 'Aportación del empleado al Seguro Social',
    },
    {
      key: 'sss_employer',
      name: 'Aportación SSS - Empleador',
      type: 'employer',
      category: 'social_security',
      percentage: 3.625,
      description: 'Aportación del empleador al Seguro Social',
    },
    {
      key: 'isr_rate',
      name: 'Tasa ISR',
      type: 'fixed',
      category: 'isr',
      percentage: 5.0,
      minRange: 0,
      maxRange: 100000,
      description: 'Impuesto sobre la Renta - Tramo 1',
    },
    {
      key: 'educational_insurance_employee',
      name: 'Seguro Educativo - Empleado',
      type: 'employee',
      category: 'educational_insurance',
      percentage: 1.5,
      description: 'Aportación del empleado al seguro educativo',
    },
    {
      key: 'educational_insurance_employer',
      name: 'Seguro Educativo - Empleador',
      type: 'employer',
      category: 'educational_insurance',
      percentage: 1.5,
      description: 'Aportación del empleador al seguro educativo',
    },
    {
      key: 'private_insurance_rate',
      name: 'Tasa de Seguro Privado',
      type: 'fixed',
      category: 'other',
      percentage: 2.0,
      description: 'Tasa estándar para seguros privados',
    },
  ]

  for (const param of legalParameters) {
    const existing = await prisma.legalParameter.findUnique({
      where: { key: param.key },
    })

    if (!existing) {
      await prisma.legalParameter.create({
        data: {
          ...param,
          status: 'active',
        },
      })
      console.log(`✅ Parámetro legal creado: ${param.name}`)
    } else {
      console.log(`ℹ️ Parámetro legal existente: ${param.name}`)
    }
  }

  /* ============================
     COMPANIES
  ============================ */

  console.log('\n🏢 Creando compañías...')

  const companies: Record<string, any> = {}

  for (const name of ['Intermaritime', 'PMTS']) {
    let company = await prisma.company.findUnique({ where: { name } })

    if (!company) {
      company = await prisma.company.create({
        data: {
          name,
          code: await generateNextCompanyCode(),
          isActive: true,
        },
      })
      console.log(`✅ Compañía creada: ${name}`)
    } else {
      console.log(`ℹ️ Compañía existente: ${name}`)
    }

    companies[name] = company
  }

  /* ============================
     DEPARTMENTS
  ============================ */

  console.log('\n🏛️ Creando departamentos...')

  const departments: Record<string, any> = {}

  const departmentData = [
    { name: 'Administración', company: 'Intermaritime' },
    { name: 'Administración', company: 'PMTS' },
  ]

  for (const d of departmentData) {
    let department = await prisma.department.findFirst({
      where: {
        name: d.name,
        companyId: companies[d.company].id,
      },
    })

    if (!department) {
      department = await prisma.department.create({
        data: {
          name: d.name,
          description: `${d.name} - ${d.company}`,
          companyId: companies[d.company].id,
          isActive: true,
        },
      })
      console.log(`✅ Departamento creado: ${d.name} (${d.company})`)
    } else {
      console.log(`ℹ️ Departamento existente: ${d.name} (${d.company})`)
    }

    departments[`${d.name}_${d.company}`] = department
  }

  /* ============================
     SUPER ADMIN
  ============================ */

  console.log('\n👨‍💼 Creando SUPER_ADMIN...')

  const superAdminEmail = 'david@intermaritime.org'

  let superAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ email: superAdminEmail }, { username: 'superadmin' }],
    },
    include: { person: true },
  })

  if (!superAdmin) {
    const userCode = await generateNextUserCode()

    superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        username: 'superadmin',
        password: passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        person: {
          create: {
            firstName: 'Carlos',
            lastName: 'Sanchez',
            fullName: 'Carlos Sanchez',
            contactEmail: superAdminEmail,
            status: 'Activo',
            userCode,
            departmentId: departments['Administración_Intermaritime'].id,
            companyId: companies['Intermaritime'].id,
          },
        },
      },
      include: { person: true },
    })

    const allCompanies = await prisma.company.findMany({
      select: { id: true },
    })

    await prisma.userCompany.createMany({
      data: allCompanies.map(c => ({
        userId: superAdmin!.id,
        companyId: c.id,
      })),
      skipDuplicates: true,
    })

    console.log('✅ SUPER_ADMIN creado y asignado a todas las compañías')
  } else {
    console.log('ℹ️ SUPER_ADMIN existente')
  }

  /* ============================
     OTHER USERS
  ============================ */

  console.log('\n👥 Creando usuarios...')

  const users = [
    {
      email: 'maria.sosa@test.com',
      username: 'maria.sosa',
      role: UserRole.MODERATOR,
      company: 'PMTS',
      department: 'Administración',
      firstName: 'Maria',
      lastName: 'Sosa',
      position: 'Moderador',
    },
  ]

  for (const u of users) {
    let user = await prisma.user.findUnique({
      where: { email: u.email },
    })

    if (!user) {
      const userCode = await generateNextUserCode()

      user = await prisma.user.create({
        data: {
          email: u.email,
          username: u.username,
          password: passwordHash,
          role: u.role,
          isActive: true,
          person: {
            create: {
              firstName: u.firstName,
              lastName: u.lastName,
              fullName: `${u.firstName} ${u.lastName}`,
              contactEmail: u.email,
              position: u.position,
              status: 'Activo',
              userCode,
              departmentId: departments[`${u.department}_${u.company}`].id,
              companyId: companies[u.company].id,
            },
          },
        },
      })

      await prisma.userCompany.create({
        data: {
          userId: user.id,
          companyId: companies[u.company].id,
        },
      })

      console.log(`✅ Usuario creado: ${u.email}`)
    } else {
      console.log(`ℹ️ Usuario existente: ${u.email}`)
    }
  }

  console.log('\n🎉 Seed ejecutado correctamente')
}

/* ============================
   RUN
============================ */

main()
  .catch(err => {
    console.error('❌ Error en seed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })